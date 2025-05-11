from pydantic import BaseModel
from typing import Literal, Optional


class UserBase(BaseModel):
    name: str
    email: str
    role: Literal["admin", "manager", "member"] = "member"
    department: str = ""
    departmentId: Optional[str] = None


class UserCreate(BaseModel):
    uid: str
    name: str
    email: str


class UserInvite(BaseModel):
    email: str
    name: str
    role: Literal["admin", "manager", "member"] = "member"
    department: str = ""


class UserResponse(UserBase):
    uid: str
    companyId: str
    createdAt: str
