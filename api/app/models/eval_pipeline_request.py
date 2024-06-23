from pydantic import BaseModel


class EvalPipelineRequest(BaseModel):
    workflow: str
    index: str
