from __future__ import annotations

from pydantic import BaseModel
from typing import Literal, Optional


class StepConfig(BaseModel):
    url: Optional[str] = None
    description: Optional[str] = None
    showAggregatedValue: Optional[bool] = None
    approverIds: Optional[list[str]] = None
    autoNotify: Optional[bool] = None
    # trigger_workflow
    targetWorkflowId: Optional[str] = None
    passData: Optional[bool] = None


class WorkflowStep(BaseModel):
    id: str
    order: int
    type: Literal["confirm_url", "approval", "auto_aggregate", "confirm_value", "input", "webhook", "ai_check", "ai_generate", "conditional", "notification", "wait", "mcp_tool", "trigger_workflow"]
    label: str
    config: StepConfig = StepConfig()


class WorkflowSchedule(BaseModel):
    type: Literal["daily", "weekly", "monthly", "manual"] = "manual"
    dayOfMonth: Optional[int] = None
    dayOfWeek: Optional[int] = None
    time: str = "09:00"


class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    schedule: WorkflowSchedule = WorkflowSchedule()
    assigneeIds: list[str] = []
    approverIds: list[str] = []
    steps: list[WorkflowStep] = []
    visibility: Literal["private", "department", "company"] = "private"
    departmentId: Optional[str] = None
    sharedDepartmentIds: list[str] = []


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[WorkflowSchedule] = None
    assigneeIds: Optional[list[str]] = None
    approverIds: Optional[list[str]] = None
    steps: Optional[list[WorkflowStep]] = None
    visibility: Optional[Literal["private", "department", "company"]] = None
    departmentId: Optional[str] = None
    sharedDepartmentIds: Optional[list[str]] = None


class WorkflowResponse(WorkflowCreate):
    id: str
    companyId: str
    createdBy: str = ""
    createdAt: str
    updatedAt: str
