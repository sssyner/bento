from __future__ import annotations

from pydantic import BaseModel
from typing import Optional, Literal


class BlockConfig(BaseModel):
    workflowId: Optional[str] = None
    style: Optional[str] = None
    source: Optional[str] = None
    columns: Optional[list[dict]] = None
    sortBy: Optional[str] = None
    limit: Optional[int] = None
    chartType: Optional[str] = None
    dataSource: Optional[str] = None
    xAxis: Optional[str] = None
    yAxis: Optional[str] = None
    value: Optional[str] = None
    unit: Optional[str] = None
    trend: Optional[str] = None
    color: Optional[str] = None
    url: Optional[str] = None
    height: Optional[int] = None
    fields: Optional[list[dict]] = None
    submitAction: Optional[str] = None
    content: Optional[str] = None
    imageUrl: Optional[str] = None
    description: Optional[str] = None
    refreshInterval: Optional[int] = None


class ScreenBlock(BaseModel):
    id: str
    type: str
    label: str
    config: BlockConfig = BlockConfig()
    width: Literal["full", "half", "third"] = "full"
    order: int = 0


class AppScreen(BaseModel):
    id: str
    label: str
    icon: Optional[str] = None
    blocks: list[ScreenBlock] = []
    order: int = 0


class UserAppCreate(BaseModel):
    name: str
    screens: list[AppScreen] = []
    visibility: Literal["private", "department", "company"] = "private"
    departmentId: Optional[str] = None
    sharedDepartmentIds: list[str] = []


class UserAppUpdate(BaseModel):
    name: Optional[str] = None
    screens: Optional[list[AppScreen]] = None
    visibility: Optional[Literal["private", "department", "company"]] = None
    departmentId: Optional[str] = None
    sharedDepartmentIds: Optional[list[str]] = None


class UserAppResponse(BaseModel):
    id: str
    userId: str
    companyId: str
    name: str
    screens: list[AppScreen]
    visibility: Literal["private", "department", "company"] = "private"
    departmentId: Optional[str] = None
    sharedDepartmentIds: list[str] = []
    createdBy: str = ""
    createdAt: str
    updatedAt: str


class DataRecordCreate(BaseModel):
    data: dict


class DataRecordResponse(BaseModel):
    id: str
    data: dict
