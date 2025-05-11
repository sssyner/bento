from __future__ import annotations

from pydantic import BaseModel
from typing import Optional


class DepartmentCreate(BaseModel):
    name: str
    parentId: Optional[str] = None  # for vertical hierarchy


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    parentId: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: str
    companyId: str
    name: str
    parentId: Optional[str] = None
    managerUids: list[str] = []
    memberUids: list[str] = []
    createdAt: str
