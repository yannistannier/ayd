from typing import List

from pydantic import BaseModel


class Source(BaseModel):
    id: str
    content: str


class UserPromptResponse(BaseModel):
    sources: List[Source] | None = None
    content: str | None = None
    generation_completed: bool | None = None
