"""
Conversational workflow generator.
Takes natural language business descriptions and generates workflow definitions.
This is the core of Bento's value: "describe your work → get an app."
"""

from __future__ import annotations
import json
import uuid
from app.services.ai.registry import get_ai
from app.services.ai.base import AIMessage

# All available step types that the AI can use
STEP_TYPES_DESCRIPTION = """
Available step types for building workflows:

1. confirm_url - Open a URL and visually confirm
   Config: { url, description, showAggregatedValue? }
   Use for: Checking spreadsheets, dashboards, external systems

2. approval - Request approval from a manager/approver
   Config: { approverIds?, description, autoNotify? }
   Use for: Manager sign-off, budget approval, document review

3. auto_aggregate - Automatically aggregate data from a source
   Config: { source: "google_sheets"|"api"|"firestore", spreadsheetId?, sheetName?, aggregation: "sum"|"count"|"average", targetColumn?, dateColumn?, dateRange? }
   Use for: Sales totals, expense summaries, inventory counts

4. confirm_value - Display a computed/aggregated value for human confirmation
   Config: { description, valueLabel, expectedRange? }
   Use for: Confirming totals, checking calculations

5. input - Free-form input (text, number, date, file, image, select)
   Config: { fields: [{ key, label, type: "text"|"number"|"date"|"email"|"tel"|"url"|"textarea"|"select"|"file"|"image", required?, options?: [{value,label}], placeholder? }] }
   Use for: Notes, expense entries, customer info, photo uploads, reports

6. ai_check - AI analyzes data and flags anomalies
   Config: { description, checkType: "anomaly"|"trend"|"comparison"|"classification", dataSource? }
   Use for: Detecting unusual values, trend analysis, auto-categorization

7. ai_generate - AI generates content (text, image, summary)
   Config: { description, generationType: "text"|"image"|"summary"|"report"|"email_draft", prompt?, outputFormat? }
   Use for: Creating reports, generating marketing images, drafting emails

8. webhook - Call an external API
   Config: { url, method: "GET"|"POST"|"PUT", headers?, bodyTemplate?, description }
   Use for: Integrating with Slack, freee, Salesforce, custom APIs

9. conditional - Branch based on a condition
   Config: { condition, description, trueStepId?, falseStepId? }
   Use for: Different flows based on amounts, status, approval results

10. notification - Send a notification (push/email)
    Config: { type: "push"|"email"|"both", recipientIds?, subject?, bodyTemplate?, description }
    Use for: Alerting team members, sending reports, deadline reminders

11. wait - Wait for an external event or time
    Config: { waitType: "duration"|"datetime"|"event", duration?, datetime?, eventType?, description }
    Use for: Scheduled delays, waiting for external confirmations

12. mcp_tool - Execute a connected external tool via MCP protocol
    Config: { connectionId, toolName, arguments: {}, description }
    Use for: Reading/writing Google Sheets, sending Slack messages, querying Notion, creating calendar events, etc.
    IMPORTANT: Only use this step type when the user has connected external tools (listed in CONNECTED EXTERNAL TOOLS section).

13. trigger_workflow - Trigger another workflow and pass data to it
    Config: { targetWorkflowId, passData?: true, description }
    Use for: Chaining workflows together. E.g., after an employee fills out an expense form,
    trigger the manager's approval workflow. Each person has their own workflow,
    but they connect via trigger_workflow. The target workflow receives all data from the source.
    IMPORTANT: When the user describes a process that involves multiple people (e.g., employee submits → manager approves),
    suggest splitting into separate workflows connected by trigger_workflow.
    This way each person can customize their own workflow independently.
"""


SYSTEM_PROMPT = f"""You are Bento's workflow builder AI.
Your job is to understand the user's business processes through conversation,
then generate workflow definitions that automate their work.

{STEP_TYPES_DESCRIPTION}

CONVERSATION GUIDELINES:
- Ask clarifying questions to understand the user's actual workflow
- Identify tools/services they already use (URLs, apps, spreadsheets)
- Understand who does what (roles, approvers, team structure)
- Suggest improvements based on best practices
- Respond in the same language as the user

OUTPUT FORMAT:
Generate workflow definitions wrapped in ```workflow-json``` code blocks.

WORKFLOW EXAMPLE:
```workflow-json
{{
  "name": "月次経理締め",
  "description": "月末の売上・経費確定作業",
  "schedule": {{ "type": "monthly", "dayOfMonth": -1, "time": "09:00" }},
  "steps": [
    {{
      "id": "step_1",
      "order": 1,
      "type": "auto_aggregate",
      "label": "売上データ集計",
      "config": {{ "source": "google_sheets", "aggregation": "sum" }}
    }}
  ]
}}
```

KEY PRINCIPLES:
- Start simple, add complexity as needed
- Always suggest automation where possible
- Identify approval bottlenecks and suggest optimizations
- Consider mobile-friendliness (users will do this on phones)
- Think about error cases and what happens when things go wrong
"""


def _extract_json_block(text: str, marker: str) -> tuple[dict | None, str]:
    """Extract a JSON block wrapped in ```{marker}``` from text.
    Returns (parsed_json, cleaned_text)."""
    full_marker = f"```{marker}"
    if full_marker not in text:
        return None, text

    try:
        json_start = text.index(full_marker) + len(full_marker)
        json_end = text.index("```", json_start)
        raw_json = text[json_start:json_end].strip()
        parsed = json.loads(raw_json)

        # Remove the JSON block from reply text
        before = text[:text.index(full_marker)].strip()
        after = text[json_end + 3:].strip()
        cleaned = before
        if after:
            cleaned += "\n\n" + after

        return parsed, cleaned
    except (json.JSONDecodeError, ValueError):
        return None, text


def _build_mcp_tools_prompt(mcp_tools: list[dict]) -> str:
    """Build a dynamic prompt section describing connected MCP tools."""
    if not mcp_tools:
        return ""
    lines = ["\nCONNECTED EXTERNAL TOOLS (via MCP):"]
    lines.append("You can use these tools in workflows by creating mcp_tool steps.")
    lines.append("When the user mentions tasks that match these tools, prefer using them.\n")
    for tool in mcp_tools:
        params = tool.get("parameters", {})
        param_props = params.get("properties", {})
        param_names = ", ".join(param_props.keys()) if param_props else "none"
        lines.append(
            f"- {tool['name']} ({tool.get('connection_id', 'unknown')}): "
            f"{tool.get('description', 'No description')}"
        )
        lines.append(f"  Parameters: {param_names}")
    return "\n".join(lines)


async def chat_generate_workflow(
    messages: list[dict],
    company_context: dict | None = None,
    mcp_tools: list[dict] | None = None,
    mode: str | None = None,
) -> dict:
    """
    Process a conversation turn for workflow generation.
    Returns: { "reply": str, "workflow": dict | None, "app": None, "tool_call": dict | None }
    """
    ai = get_ai()

    # Build system prompt with MCP tools if available
    system_prompt = SYSTEM_PROMPT
    if mcp_tools:
        system_prompt += _build_mcp_tools_prompt(mcp_tools)

    ai_messages = [AIMessage(role="system", content=system_prompt)]

    # Add company context if available
    if company_context:
        context_msg = f"User's company context: {json.dumps(company_context, ensure_ascii=False)}"
        ai_messages.append(AIMessage(role="system", content=context_msg))

    # Convert conversation history
    for msg in messages:
        ai_messages.append(AIMessage(
            role=msg["role"],
            content=msg["content"],
        ))

    response = await ai.chat(ai_messages, temperature=0.7, max_tokens=4096)
    text = response.text

    # Extract workflow JSON if present
    workflow, text = _extract_json_block(text, "workflow-json")
    if workflow:
        for i, step in enumerate(workflow.get("steps", [])):
            if not step.get("id"):
                step["id"] = f"step_{uuid.uuid4().hex[:8]}"
            step["order"] = i + 1

    # Extract tool-call JSON if present (for direct tool execution in chat)
    tool_call, text = _extract_json_block(text, "tool-call")

    return {
        "reply": text,
        "workflow": workflow,
        "app": None,
        "tool_call": tool_call,
    }


async def suggest_templates(industry: str, description: str) -> list[dict]:
    """Suggest workflow templates based on industry and description."""
    ai = get_ai()

    prompt = f"""Based on the following industry and business description,
suggest 3 workflow templates that would be most useful.

Industry: {industry}
Description: {description}

For each template, provide:
- name: Template name
- description: What it does
- steps: Array of step definitions using the available step types

{STEP_TYPES_DESCRIPTION}

Return as a JSON array of workflow objects."""

    try:
        result = await ai.chat(
            [AIMessage(role="user", content=prompt)],
            temperature=0.5,
            max_tokens=4096,
            response_mime_type="application/json",
        )
        templates = json.loads(result.text)
        if isinstance(templates, list):
            return templates
        return templates.get("templates", [])
    except Exception:
        return []
