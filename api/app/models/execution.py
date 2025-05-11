from __future__ import annotations

from pydantic import BaseModel
from typing import Literal, Optional


class StepResult(BaseModel):
    status: Literal["pending", "in_progress", "completed", "rejected"]
    result: Optional[dict] = None
    completedAt: Optional[str] = None
    completedBy: Optional[str] = None
    rejectedReason: Optional[str] = None


class ExecutionResponse(BaseModel):
    id: str
    templateId: str
    companyId: str
    assigneeId: str
    status: Literal["pending", "in_progress", "completed", "rejected"]
    currentStepId: str
    startedAt: str
    completedAt: Optional[str] = None
    steps: dict[str, StepResult]
    template: Optional[dict] = None
    # Chain info: where this execution was triggered from
    sourceExecutionId: Optional[str] = None
    sourceWorkflowName: Optional[str] = None
    sourceAssigneeName: Optional[str] = None
    sourceData: Optional[dict] = None


class StepCompleteRequest(BaseModel):
    result: Optional[dict] = None


class StepRejectRequest(BaseModel):
    reason: str = ""
