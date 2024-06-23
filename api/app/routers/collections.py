import asyncio
import json
import os
from datetime import datetime
from typing import Annotated, List

from beanie import PydanticObjectId
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Form
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.config.minio import COLLECTIONS_BUCKET_NAME, client as minio_client
from app.exceptions.custom_exception import CustomException
from app.models.documents.collection import Collection as CollectionModel, CollectionFile
from app.utils.file import UploadFile as CustomUploadFile
from app.utils.minio import remove_files_from_bucket, upload_file_to_bucket
from app.utils.qdrant import ingest_file, remove_qdrant_index, create_qdrant_collection_index, \
    remove_files_from_qdrant_index

router = APIRouter(
    prefix="/collections",
    tags=["collections"],
)


# -------------------------------------------------------------------------------------------------------------------- #
# GET Collections ---------------------------------------------------------------------------------------------------- #
# -------------------------------------------------------------------------------------------------------------------- #

# Single collection model response
class CollectionListItem(BaseModel):
    id: PydanticObjectId = Field(alias="_id")
    name: str
    created_at: datetime
    updated_at: datetime
    nb_files: int


# Collection list model response
class CollectionList(BaseModel):
    data: List[CollectionListItem]


@router.get(
    "/",
    response_description="List all collections",
    response_model=CollectionList,
    response_model_by_alias=False,
)
async def get_collections():
    """Returns the list of available collections

    Returns:
        List[CollectionListItem]: A list of collection items

    Raises:
        HTTPException
    """

    try:
        # We retrieve our collections and add our custom 'nb_files' field
        # Fixme: this field can be auto calculated by hooks maybe in the model
        collections = await CollectionModel.aggregate(
            [
                {
                    "$addFields": {
                        "nb_files": {"$size": "$files"}
                    }
                }
            ]
        ).to_list(length=None)
        print("OK")
        # We conform our list to the 'CollectionListItem' model format
        enriched_collections = CollectionList(
            data=[CollectionListItem(**collection) for collection in collections]
        )
        return enriched_collections

    except Exception:
        raise CustomException(
            original_exception=HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while fetching the collections",
            )
        )


# -------------------------------------------------------------------------------------------------------------------- #
# CREATE Collection -------------------------------------------------------------------------------------------------- #
# -------------------------------------------------------------------------------------------------------------------- #

# Expected collection request model
class CreateCollectionRequest(BaseModel):
    name: str


async def create_qdrant_collection_index_async(index: str):
    """Creates a new index in the qdrant collection | async version

    Args:
        index (str): The index to create

    Returns:
        None
    """
    await asyncio.to_thread(create_qdrant_collection_index, index)


@router.post(
    "/",
    response_description="Create a new collection",
    status_code=status.HTTP_201_CREATED,
    response_model=CollectionModel,
    response_model_by_alias=False,
)
async def create_collection(
        collection: CreateCollectionRequest
):
    """Creates a new collection in the database

    Args:
        collection (CreateCollectionRequest): The collection entity containing the index field

    Returns:
        CollectionModel: The created collection

    Raises:
        CustomException

    """

    try:
        # Fixme: transactions do not work due to replicaset configuration
        # We'll execute all operations in a transaction, so if one fails, we don't insert anything
        # async with await mongo_client.start_session() as s:
        #     async with s.start_transaction():
        # We store the current date into a variable to be used for both 'created_at' and 'updated_at' fields
        # Fixme: we should use pre-save hooks for that but there is a bug with beanie
        current_date = datetime.now()

        # We start by ensuring no collection with the same name already exists
        existing_collection = await CollectionModel.find_one({"name": collection.name})
        if existing_collection is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A collection with the name {collection.name} already exists",
            )

        # We can now safely create our new collection
        # We start by creating a new collection model instance
        try:
            new_collection_instance = CollectionModel(
                name=collection.name,
                created_at=current_date,
                updated_at=current_date,
            )

            # We insert our new instance into the database
            new_collection = await new_collection_instance.create()

            # Let's fetch the newly created collection
            created_collection = await CollectionModel.get(new_collection.id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while creating and retrieving the collection {collection.name} in mongodb",
            )

        # After creating the collection in mongodb, we can use the collection id to create corresponding index in qdrant
        try:
            await create_qdrant_collection_index_async(str(created_collection.id))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while creating the collection {collection.name} in qdrant",
            )

        return created_collection
    except Exception as e:
        raise CustomException(
            message="An error occurred while creating the collection {collection.name}",
            original_exception=e
        )


# -------------------------------------------------------------------------------------------------------------------- #
# PATCH Collection --------------------------------------------------------------------------------------------------- #
# -------------------------------------------------------------------------------------------------------------------- #

# Request body format model
class UpdateCollectionRequest(BaseModel):
    name: str


@router.patch(
    "/{collection_id}",
    response_description="Update a collection",
    response_model=CollectionModel,
    response_model_by_alias=False,
)
async def patch_collection(collection_id: str, collection: UpdateCollectionRequest):
    """Updates a collection

    Args:
        collection_id (str): The collection id
        collection (UpdateCollectionRequest): The collection entity to update to

    Returns:
        CollectionModel: The updated collection

    Raises:
        CustomException
        HTTPException

    """

    try:
        # We check if the collection exists
        if (existing_collection := await CollectionModel.get(collection_id)) is not None:

            # We prepare a dictionary that contains all the specified collection fields
            collection_data = {
                k: v for k, v in collection.model_dump(by_alias=True).items()
            }

            try:
                # We update the collection with all fields within our request collection model
                # Fixme: we should use pre-save hooks for that but there is a bug with beanie
                await existing_collection.update({"$set": {**collection_data, "updated_at": datetime.now()}})

                # Let's fetch the newly updated collection and return it
                updated_collection = await CollectionModel.get(existing_collection.id)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Error while updating {collection_id} in mongodb",
                )
            return updated_collection
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection {collection_id} to update not found"
            )
    except Exception as e:
        raise CustomException(
            message=f"Error while updating the collection {collection_id}",
            original_exception=e
        )


async def upload_file_to_bucket_async(object_name: str, file: UploadFile):
    """Uploads a file to the bucket | async version

    Args:
        object_name (str): The object name
        file (UploadFile): The file to upload

    Returns:
        None
    """
    await asyncio.to_thread(upload_file_to_bucket, COLLECTIONS_BUCKET_NAME, object_name, file)


# -------------------------------------------------------------------------------------------------------------------- #
# ADD files to Collection -------------------------------------------------------------------------------------------- #
# -------------------------------------------------------------------------------------------------------------------- #

async def ingest_file_async(collection_id: str, file: UploadFile, filename: str, preprocessed: bool):
    """Ingests a file into qdrant collection | async version

    Args:
        collection_id(str): The collection id
        file (UploadFile): The file to ingest
        filename (str): The file name
        preprocessed (bool): Whether the file is already preprocessed
    """
    await asyncio.to_thread(ingest_file, collection_id, file, filename, preprocessed)


async def upload_files_to_collection(collection_id: str, files: list[UploadFile], preprocessed: bool):
    current_date = datetime.now()

    try:
        # We check if the collection exists
        if (existing_collection := await CollectionModel.get(collection_id)) is not None:

            # We insert our list of files in mongodb
            yield f"""{json.dumps({
                "event": "uploadFeedback",
                "data": {
                    "message": "Préparation de l'envoi...",
                },
            })}\n"""

            # async with await mongo_client.start_session() as s:
            #     async with s.start_transaction():
            # We start by creating a list of files to embed
            try:
                # Let's create a list of CollectionFile instances
                collection_files = [
                    CollectionFile(
                        name=file.filename,
                        extension=os.path.splitext(file.filename)[1],
                        size=file.size,
                        content_type=file.content_type,
                        updated_at=current_date,
                    ) for index, file in enumerate(files)
                ]

                # We can now extend the list of files in our collection
                existing_collection.files.extend(collection_files)

                # We persist the changes in the database
                await existing_collection.save()
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error while adding files to mongodb for collection {collection_id}",
                )

            # We can now upload all the files concurrently into the minio bucket
            # try:
            #     yield f"""{json.dumps({
            #         "event": "uploadFeedback",
            #         "data": {
            #             "message": "Récupération des fichiers...",
            #         },
            #     })}\n"""

            #     upload_files_to_bucket_tasks = [
            #         upload_file_to_bucket_async(
            #             f"collections/{collection_id}/file/{collection_files[index].id}/{file.filename}",
            #             file
            #         ) for index, file in enumerate(files)
            #     ]
            #     await asyncio.gather(*upload_files_to_bucket_tasks)
                
            # except Exception:
            #     raise HTTPException(
            #         status_code=status.HTTP_400_BAD_REQUEST,
            #         detail=f"Error while uploading files to minio for collection {collection_id}",
            #     )

            # We then ingest all the files concurrently
            try:
                yield f"""{json.dumps({
                    "event": "uploadFeedback",
                    "data": {
                        "message": "Formatage des fichiers...",
                    },
                })}\n"""
                ingest_data_tasks = [
                    ingest_file_async(
                        collection_id,
                        file,
                        # Fixme: test files without extension
                        f"{collection_files[index].id}{collection_files[index].extension if collection_files[index].extension else ''}",
                        preprocessed
                    )
                    for index, file in enumerate(files)
                ]
                await asyncio.gather(*ingest_data_tasks)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error while ingesting files to qdrant for collection {collection_id}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection {collection_id} to add files to not found"
            )
    except Exception as e:
        raise CustomException(
            message=f"Error while uploading files to the collection {collection_id}",
            original_exception=e
        )
    finally:
        # Fixme: Due to an issue, we manually close the files for now until a fix is provided by fastapi
        for file in files:
            await file.close()


@router.post("/{collection_id}/files/upload")
async def upload_files(
        collection_id: str,
        files: Annotated[List[UploadFile], list[File()]],
        preprocessed: Annotated[bool, Form()],
):
    """Uploads files and put them into a collection

    Args:
        collection_id (str): The collection id
        files (List[UploadFile]): The list of files to upload
        preprocessed (bool): Whether the files are already preprocessed

    Returns:
        StreamingResponse: The streaming response

    """
    return StreamingResponse(
        # Fixme: Due to a fastapi issue, we'll convert our files into custom UploadFile instances
        # that do not have the close method available
        # since this close method is called before the file is processed
        # when passed to a StreamingResponse
        upload_files_to_collection(collection_id, [CustomUploadFile(file) for file in files], preprocessed),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# -------------------------------------------------------------------------------------------------------------------- #
# GET single collection ---------------------------------------------------------------------------------------------- #
# -------------------------------------------------------------------------------------------------------------------- #

@router.get(
    "/{collection_id}",
    response_description="Get a collection",
    response_model=CollectionModel,
)
async def get_files(collection_id: str):
    """Returns the collection data

    Args:
        collection_id (str): The collection id

    Returns:
        CollectionModel: The collection data

    Raises:
        HTTPException
    """

    try:
        return await CollectionModel.get(collection_id)

    except Exception:
        raise CustomException(
            original_exception=HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while data from collection {collection_id}",
            )
        )


# -------------------------------------------------------------------------------------------------------------------- #
# DOWNLOAD collection file ------------------------------------------------------------------------------------------- #
# -------------------------------------------------------------------------------------------------------------------- #

async def get_file_from_bucket_async(object_name: str, output_file_path: str):
    """"Downloads a file from minio | async version

    Args:
        object_name (str): The object name
        output_file_path (str): The output file path

    Returns:
        None

    """
    await asyncio.to_thread(minio_client.fget_object, COLLECTIONS_BUCKET_NAME, object_name, output_file_path)


@router.get(
    "/{collection_id}/files/{file_id}",
    response_description="Download a file from a collection",
)
async def download_file(collection_id: str, file_id: str):
    """Download a file from a collection
    
    Args:
        collection_id (str): The collection id
        file_id (str): The file id

    Returns:
        FileResponse: The file response

    Raises:
        HTTPException
        CustomException
    """

    try:
        # We start by checking if the file exists in our mongoDB database
        existing_files = await CollectionModel.aggregate(
            [
                {
                    "$unwind": {"path": "$files"}
                },
                {
                    "$match": {
                        "_id": PydanticObjectId(collection_id),
                        "files._id": PydanticObjectId(file_id)
                    }
                }
            ]
        ).to_list(length=None)

        if (existing_file := existing_files[0]) is not None:
            # We retrieve the file from minio and store in it a temporary file
            try:
                # Let's store the file in a temporary location
                tmp_file_path = f"/tmp/{collection_id}-{file_id}"

                # We retrieve the file from minio
                await get_file_from_bucket_async(
                    f"collections/{collection_id}/file/{file_id}/{existing_file['files']['name']}",
                    tmp_file_path
                )

            except HTTPException:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Error while retrieving file {file_id} from collection {collection_id} from minio",
                )

            # We check if the file has been correctly created
            if not os.path.exists(tmp_file_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Unable to create file (collection_id: {collection_id}, file_id: {file_id}) for download"
                )

            # We serve the file to the client
            return FileResponse(
                tmp_file_path,
                media_type='application/octet-stream',
                filename=existing_file['files']['name']
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File {file_id} to download from collection {collection_id} not found",
            )
    except Exception as e:
        raise CustomException(
            message=f"Error while downloading the file {file_id} from collection {collection_id}",
            original_exception=e
        )


# -------------------------------------------------------------------------------------------------------------------- #
# DELETE collection -------------------------------------------------------------------------------------------------- #
# -------------------------------------------------------------------------------------------------------------------- #

async def remove_files_from_bucket_async(prefix: str):
    """Remove files from a bucket with a specific prefix | async version
    
    Args:
        prefix (str): The prefix
        
    Returns:
        None
    """
    await asyncio.to_thread(remove_files_from_bucket, COLLECTIONS_BUCKET_NAME, prefix)


async def remove_qdrant_index_async(index: str):
    """Remove the qdrant index | async version
    
    Args:
        index (str): The index to remove
    
    Returns:
        None
    """
    await asyncio.to_thread(remove_qdrant_index, index)


@router.delete(
    "/{collection_id}",
    response_description="Delete a collection",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_collection(collection_id: str):
    """Deletes a collection
    
    Args:
        collection_id (str): The collection id
        
    Returns:
        None
        
    Raises:
        HTTPException
        CustomException
    """

    # Fixme: this fonction should be more robust to avoid cases where some operation can fail
    # Fixme: this can lead to incomplete / corrupted collections
    try:
        # We start by checking if the collection exists
        if (existing_collection := await CollectionModel.get(collection_id)) is not None:
            # We remove all files from minio
            # try:
            #     await remove_files_from_bucket_async(f"collections/{existing_collection.id}")
            # except Exception:
            #     raise HTTPException(
            #         status_code=status.HTTP_400_BAD_REQUEST,
            #         detail=f"Error while deleting the collection {collection_id} files from minio",
            #     )

            # We delete the collection index in qdrant
            try:
                await remove_qdrant_index_async(str(collection_id))
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error while deleting the collection {collection_id} files from qdrant",
                )

            # We delete the collection and all its associated files in mongodb
            try:
                await existing_collection.delete()
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error while deleting the collection {collection_id} from mongodb",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Collection {collection_id} to delete not found"
            )
    except Exception as e:
        raise CustomException(
            message=f"Error while deleting the collection {collection_id}",
            original_exception=e
        )


# -------------------------------------------------------------------------------------------------------------------- #
# DELETE file from collection ---------------------------------------------------------------------------------------- #
# -------------------------------------------------------------------------------------------------------------------- #


async def remove_files_from_qdrant_index_async(index: str, filename: str):
    """
    Removes a file from a specific qdrant index | async version
    :param index:
    :param filename:
    :return:
    """
    await asyncio.to_thread(remove_files_from_qdrant_index, index, filename)


@router.delete(
    "/{collection_id}/files/{file_id}",
    response_description="Delete a file",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_file(collection_id: str, file_id: str):
    """Remove a file from a qdrant collection

    Args:
        collection_id (str): The collection id
        file_id (str): The file id

    Returns:
        None

    Raises:
        HTTPException
        CustomException
    """

    try:
        # We check if the file actually exists in the collection
        # Fixme: refactor request used multiple times, maybe attach to Collection model directly
        existing_files = await CollectionModel.aggregate(
            [
                {
                    "$unwind": {"path": "$files"}
                },
                {
                    "$match": {
                        "_id": PydanticObjectId(collection_id),
                        "files._id": PydanticObjectId(file_id)
                    }
                }
            ]
        ).to_list(length=None)

        if (existing_file := existing_files[0]) is not None:
            # We delete the file in qdrant
            try:
                await remove_files_from_qdrant_index_async(
                    collection_id,
                    f"{existing_file['files']['_id']}{existing_file['files']['extension'] if existing_file['files']['extension'] else ''}",
                )
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error while deleting the file {file_id} from qdrant",
                )

            # We then delete the file in minio
            try:
                await remove_files_from_bucket_async(f"collections/{collection_id}/file/{file_id}")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error while deleting the file {file_id} from minio",
                )

            # We delete the file in mongodb
            try:
                # We grab the corresponding collection that has the file first
                existing_collections = await CollectionModel.find(
                    CollectionModel.id == PydanticObjectId(collection_id),
                    CollectionModel.files._id == PydanticObjectId(file_id),
                ).to_list(length=None)

                # We then pop the file out from the collection
                await existing_collections[0].update(
                    {
                        "$pull": {
                            "files": {
                                "_id": PydanticObjectId(file_id)
                            }
                        }
                    }
                )

            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error while deleting the file {file_id} from mongodb",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File {file_id} to delete not found",
            )
    except Exception as e:
        raise CustomException(
            message=f"Error while deleting the file {file_id} from collection {collection_id}",
            original_exception=e
        )
