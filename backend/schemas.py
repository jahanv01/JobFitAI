from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class ProfileIn(BaseModel):
    name: str
    raw_text: Optional[str] = None
    structured_json: Optional[dict[str, Any]] = None


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    raw_text: Optional[str] = None
    structured_json: Optional[dict[str, Any]] = None
    updated_at: Optional[datetime] = None
