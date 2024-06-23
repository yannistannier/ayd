from datetime import datetime
from typing import List

from beanie import Document, PydanticObjectId
from bson import ObjectId
from pydantic import BaseModel, Field


class CollectionFile(BaseModel):
    id: PydanticObjectId = Field(default_factory=PydanticObjectId, alias="_id")
    name: str
    extension: str
    size: int
    content_type: str
    updated_at: datetime

    class Config:
        json_encoders = {
            ObjectId: str
        }
        populate_by_name = True  # Allow population using field names or aliases


class Collection(Document):
    name: str  # this will be used as the index in qdrant
    # description: str  # Fixme: would be nice to add a description field later
    created_at: datetime
    updated_at: datetime
    # Fixme: we could have used Link and Backlink here
    # Fixme: but it does not seem to be working properly, on top of creating DBRefs
    files: List[CollectionFile] = []

    # Fixme: uncomment when the BUG will be fixed by beanie | https://github.com/BeanieODM/beanie/issues/913
    # @before_event(Insert)
    # def set_created_and_updated_date(self):
    #     current_date = datetime.now()
    #     self.created_at = current_date
    #     self.updated_at = current_date
    #
    # @before_event(Update)
    # def set_updated_at(self):
    #     self.updated_at = datetime.now()

    class Settings:
        name = "collections"
