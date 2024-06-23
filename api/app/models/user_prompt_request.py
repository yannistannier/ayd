from pydantic import BaseModel, Field

from app.utils.minio import token_pattern


class UserPromptRequest(BaseModel):
    workflow: str
    mode: str
    collection_id: str | None = None
    collection_name: str | None = None
    index: str
    message: str
    token: str = Field(pattern=token_pattern)
