from typing import Optional, TypeVar, Generic

from pydantic import BaseModel

T = TypeVar('T')


class SuccessResponse(BaseModel, Generic[T]):
    data: Optional[T] = None
