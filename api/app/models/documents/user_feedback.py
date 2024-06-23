from beanie import Document

from app.models.user_prompt_request import UserPromptRequest as UserPromptRequestModel
from app.models.user_prompt_response import UserPromptResponse


class UserPromptRequest(UserPromptRequestModel):
    # We'll derive from the original 'UserPromptRequest' but make the message field optional
    message: str | None = None


class UserFeedback(Document):
    user_prompt_request: UserPromptRequest
    user_prompt_response: UserPromptResponse
    user_feedback: int

    class Settings:
        name = "userFeedbacks"
