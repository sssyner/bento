"""
WorkflowScheduler - APScheduler-based workflow auto-execution.

Scans Firestore for workflow templates with schedules (daily/weekly/monthly)
and registers them as cron jobs. When triggered, creates an execution and
auto-progresses steps that don't require human intervention.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.services.firestore import get_db, get_company_collection
from app.routers.executions import create_execution_from_template
from app.services.mcp.tool_executor import get_tool_executor

logger = logging.getLogger("bento.scheduler")

# Step types that can be auto-executed without human intervention
AUTO_STEP_TYPES = {
    "mcp_tool",
    "auto_aggregate",
    "webhook",
    "notification",
    "ai_check",
    "ai_generate",
}

# Step types that require human action - execution pauses here
HUMAN_STEP_TYPES = {
    "approval",
    "input",
    "confirm_url",
    "confirm_value",
}


class WorkflowScheduler:
    """Manages scheduled workflow executions via APScheduler."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    async def start(self):
        """Load all scheduled workflows from Firestore and register cron jobs."""
        db = get_db()
        companies = db.collection("companies").stream()

        job_count = 0
        for company_doc in companies:
            company_id = company_doc.id
            templates_col = get_company_collection(db, company_id, "workflow_templates")
            templates = templates_col.stream()

            for tmpl_doc in templates:
                tmpl = tmpl_doc.to_dict()
                schedule = tmpl.get("schedule", {})
                if not schedule or schedule.get("type") == "manual":
                    continue

                trigger = self._build_trigger(schedule)
                if trigger is None:
                    continue

                job_id = f"{company_id}_{tmpl_doc.id}"
                self.scheduler.add_job(
                    self._execute_workflow,
                    trigger=trigger,
                    id=job_id,
                    args=[company_id, tmpl_doc.id],
                    replace_existing=True,
                )
                job_count += 1
                logger.info(
                    "Registered job %s: %s %s @ %s",
                    job_id,
                    tmpl.get("name", ""),
                    schedule.get("type"),
                    schedule.get("time", "09:00"),
                )

        self.scheduler.start()
        logger.info("Scheduler started with %d jobs", job_count)

    async def stop(self):
        """Shut down the scheduler."""
        self.scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")

    async def sync_schedules(self):
        """Re-sync all schedules from Firestore (e.g. after template update)."""
        self.scheduler.remove_all_jobs()
        # Re-register without restarting the scheduler
        db = get_db()
        companies = db.collection("companies").stream()

        for company_doc in companies:
            company_id = company_doc.id
            templates_col = get_company_collection(db, company_id, "workflow_templates")
            templates = templates_col.stream()

            for tmpl_doc in templates:
                tmpl = tmpl_doc.to_dict()
                schedule = tmpl.get("schedule", {})
                if not schedule or schedule.get("type") == "manual":
                    continue

                trigger = self._build_trigger(schedule)
                if trigger is None:
                    continue

                job_id = f"{company_id}_{tmpl_doc.id}"
                self.scheduler.add_job(
                    self._execute_workflow,
                    trigger=trigger,
                    id=job_id,
                    args=[company_id, tmpl_doc.id],
                    replace_existing=True,
                )

        logger.info("Schedules re-synced, %d active jobs", len(self.scheduler.get_jobs()))

    def _build_trigger(self, schedule: dict) -> CronTrigger | None:
        """Convert a WorkflowSchedule dict to an APScheduler CronTrigger."""
        stype = schedule.get("type")
        time_str = schedule.get("time", "09:00")
        parts = time_str.split(":")
        hour = int(parts[0]) if len(parts) >= 1 else 9
        minute = int(parts[1]) if len(parts) >= 2 else 0

        if stype == "daily":
            return CronTrigger(hour=hour, minute=minute)
        elif stype == "weekly":
            dow = schedule.get("dayOfWeek", 0)  # 0=Monday
            return CronTrigger(day_of_week=dow, hour=hour, minute=minute)
        elif stype == "monthly":
            day = schedule.get("dayOfMonth", 1)
            return CronTrigger(day=day, hour=hour, minute=minute)
        else:
            return None

    async def _execute_workflow(self, company_id: str, template_id: str):
        """Create an execution and auto-progress steps that don't need human action."""
        logger.info("Executing scheduled workflow: company=%s template=%s", company_id, template_id)

        db = get_db()

        # Determine assignee - use the first assigneeId from the template, or "system"
        templates_col = get_company_collection(db, company_id, "workflow_templates")
        tmpl_doc = templates_col.document(template_id).get()
        if not tmpl_doc.exists:
            logger.error("Template %s not found in company %s", template_id, company_id)
            return

        tmpl = tmpl_doc.to_dict()
        assignee_ids = tmpl.get("assigneeIds", [])
        assignee_id = assignee_ids[0] if assignee_ids else "system"

        # Create the execution
        exec_data = create_execution_from_template(db, company_id, template_id, assignee_id)
        if exec_data is None:
            logger.error("Failed to create execution for template %s", template_id)
            return

        exec_id = exec_data["id"]
        template = exec_data["template"]
        steps_sorted = sorted(template.get("steps", []), key=lambda s: s["order"])

        logger.info("Created execution %s with %d steps", exec_id, len(steps_sorted))

        # Auto-progress through steps that don't require human action
        exec_col = get_company_collection(db, company_id, "workflow_executions")

        for step in steps_sorted:
            step_id = step["id"]
            step_type = step.get("type", "")

            # Reload current state
            current_doc = exec_col.document(exec_id).get()
            if not current_doc.exists:
                break
            current_data = current_doc.to_dict()

            # Only process if this step is the current one and in_progress
            if current_data.get("currentStepId") != step_id:
                continue
            if current_data["steps"].get(step_id, {}).get("status") != "in_progress":
                continue

            # Human step - stop auto-progressing
            if step_type in HUMAN_STEP_TYPES or step_type not in AUTO_STEP_TYPES:
                logger.info("Pausing at human step: %s (%s)", step.get("label", ""), step_type)
                break

            # Auto-execute this step
            result = await self._auto_execute_step(company_id, step, exec_id)

            now = datetime.now(timezone.utc).isoformat()
            current_data["steps"][step_id] = {
                "status": "completed",
                "result": result,
                "completedAt": now,
                "completedBy": "scheduler",
            }

            # Advance to next step
            current_idx = next(
                (i for i, s in enumerate(steps_sorted) if s["id"] == step_id), -1
            )
            if current_idx + 1 < len(steps_sorted):
                next_step = steps_sorted[current_idx + 1]
                current_data["currentStepId"] = next_step["id"]
                current_data["steps"][next_step["id"]]["status"] = "in_progress"
            else:
                current_data["status"] = "completed"
                current_data["completedAt"] = now

            exec_col.document(exec_id).set(current_data)
            logger.info("Auto-completed step %s (%s)", step.get("label", ""), step_type)

    async def _auto_execute_step(
        self, company_id: str, step: dict, exec_id: str
    ) -> dict | None:
        """Execute a single auto step and return its result."""
        step_type = step.get("type", "")
        config = step.get("config", {})

        if step_type == "mcp_tool":
            return await self._exec_mcp_tool(company_id, config, exec_id)
        elif step_type == "webhook":
            return await self._exec_webhook(config)
        elif step_type == "notification":
            return {"sent": True, "message": config.get("description", "")}
        elif step_type in ("auto_aggregate", "ai_check", "ai_generate"):
            # Placeholder - these would integrate with respective services
            return {"type": step_type, "status": "completed"}
        return None

    async def _exec_mcp_tool(
        self, company_id: str, config: dict, exec_id: str
    ) -> dict:
        """Execute an MCP tool step."""
        connection_id = config.get("connectionId", "")
        tool_name = config.get("toolName", "")
        arguments = config.get("arguments", {})

        if not connection_id or not tool_name:
            return {"error": "Missing connectionId or toolName in step config"}

        executor = get_tool_executor()
        result = await executor.execute(
            company_id=company_id,
            connection_id=connection_id,
            tool_name=tool_name,
            arguments=arguments,
            user_id="scheduler",
            context="workflow",
        )
        return {"success": result.success, "result": result.result, "error": result.error}

    async def _exec_webhook(self, config: dict) -> dict:
        """Execute a webhook step."""
        import httpx

        url = config.get("url", "")
        if not url:
            return {"error": "No webhook URL configured"}

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                method = config.get("method", "POST").upper()
                body = config.get("body", {})
                headers = config.get("headers", {})
                if method == "GET":
                    resp = await client.get(url, headers=headers)
                else:
                    resp = await client.post(url, json=body, headers=headers)
                return {"status_code": resp.status_code, "body": resp.text[:1000]}
        except Exception as e:
            return {"error": str(e)}


# Singleton
_scheduler: WorkflowScheduler | None = None


def get_scheduler() -> WorkflowScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = WorkflowScheduler()
    return _scheduler
