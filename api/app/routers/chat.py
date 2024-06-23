import asyncio
import json
from typing import Annotated, List

from fastapi import APIRouter, File, Form, UploadFile, status, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import app.ds.rag_pipeline as rag
from app.config.logger import logger
from app.config.minio import COLLECTIONS_BUCKET_NAME
from app.config.qdrant import BASE_COLLECTION_NAME
from app.config.rag import MODELS, PRECISION
from app.config.redis import client as redis_client
from app.exceptions.custom_exception import CustomException
from app.models.app.success_response import SuccessResponse
from app.models.documents.user_feedback import UserFeedback as UserFeedbackModel
from app.models.user_prompt_request import UserPromptRequest
from app.utils.file import UploadFile as CustomUploadFile
from app.utils.input_sanitizers import sanitize_input
from app.utils.minio import remove_files_from_bucket, upload_file_to_bucket, token_pattern
from app.utils.qdrant import remove_qdrant_index, ingest_file

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)


def check_and_remove_files(token: str):
    """Check if the token has already an entry in redis and remove associated files from the bucket and qdrant

    Args:
        token (str): a specific token format

    Returns:
        None

        Raises:
            HTTPException

    """

    if redis_client.get(token):
        try:
            remove_files_from_bucket(COLLECTIONS_BUCKET_NAME, token)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while removing files from bucket",
            )

        try:
            remove_qdrant_index(token)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while removing files from vector store",
            )

        try:
            redis_client.delete(token)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while removing token entry in redis",
            )


async def upload_file_to_bucket_async(token: str, file: UploadFile):
    """Upload a file to the bucket | async version

        Args:
            token (str): The token
            file (UploadFile): The file to upload

        Returns:
            None

        """

    return await asyncio.to_thread(upload_file_to_bucket, COLLECTIONS_BUCKET_NAME, f"{token}/{file.filename}", file)


async def ingest_file_async(token: str, file: UploadFile):
    """Ingest a file into the Qdrant vector store | async version

    Args:
        token (str): User token
        file (UploadFile): File to ingest

    Returns:
        None

    """
    return await asyncio.to_thread(ingest_file, token, file, None, False)


async def upload_and_ingest_files(token: str, files: List[UploadFile]):
    """Upload and ingest files concurrently

    Args:
        token (str): The token
        files (List[UploadFile]): The files to upload and ingest

    Returns:
        None

    Raises:
        HTTPException

    """
    try:
        # We start by cleaning any potential files associated with that token
        try:
            await asyncio.to_thread(check_and_remove_files, token)
        except Exception as e:
            logger.error("Error while cleaning potentially existing files from the bucket and vector store")
            raise e

        # We can now upload all the files concurrently into the bucket
        try:
            yield f"""{json.dumps({
                "event": "uploadFeedback",
                "data": {
                    "message": "Récupération des fichiers...",
                },
            })}\n"""
            upload_files_to_bucket_tasks = [upload_file_to_bucket_async(token, file) for file in files]
            await asyncio.gather(*upload_files_to_bucket_tasks)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while uploading files to the bucket",
            )

        # We then ingest all the files concurrently
        try:
            yield f"""{json.dumps({
                "event": "uploadFeedback",
                "data": {
                    "message": "Formatage des fichiers...",
                },
            })}\n"""
            ingest_data_tasks = [ingest_file_async(token, file) for file in files]
            await asyncio.gather(*ingest_data_tasks)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while ingesting files into the vector store",
            )

        # Once the upload is done, we can store the token in redis to keep track of further client requests
        try:
            redis_client.set(token, 1)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while storing new token in redis",
            )

    except Exception as e:
        raise CustomException(
            message="Error while uploading and ingesting files",
            original_exception=e
        )
    finally:
        # Fixme: Due to an issue, we manually close the files for now until a fix is provided by fastapi
        for file in files:
            await file.close()


@router.post(
    "/upload",
    response_description="Upload files to the bucket",
    status_code=status.HTTP_201_CREATED
)
async def upload_files(
        token: Annotated[
            str,
            Form(
                pattern=token_pattern,
                description="A specific token format"
            )
        ],
        files: Annotated[
            List[UploadFile],
            File(description="A list of files to upload")
        ],
):
    """Upload files to the bucket

    Args:
        token (str): a token string
        files (List[UploadFile]): a list of files to upload

    Returns:
        StreamingResponse: A stream that reports the status of the operation to the client

    """

    return StreamingResponse(
        # Fixme: Due to a fastapi issue, we'll convert our files into custom UploadFile instances
        # that do not have the close method available
        # since this close method is called before the file is processed
        # when passed to a StreamingResponse
        upload_and_ingest_files(token, [CustomUploadFile(file) for file in files]),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


class RemoveFilesMetaDataRequest(BaseModel):
    token: str = Field(pattern=token_pattern, description="A specific token format")


@router.post(
    "/upload/clear",
    response_description="Remove the files associated with the token from the bucket",
    status_code=status.HTTP_204_NO_CONTENT
)
def removed_files(files_metadata: RemoveFilesMetaDataRequest):
    """Remove the files associated with the token from the bucket

    Args:
        files_metadata (RemoveFilesDataRequest): The metadata of the files to remove
            - token (str): A specific token format


    Returns:
        None

    Raises:
        CustomHTTPException

    """

    try:
        check_and_remove_files(files_metadata.token)
    except Exception as e:
        raise CustomException(
            message="Error while checking and removing files",
            original_exception=e
        )


def generate_user_prompt_response(generator, sources):
    """Generate a stream of data containing the sources and the response message

    Args:
        generator: The response generator
        sources: The sources that helped generate the response

    Returns:
        None

    """

    # We start by returning the sources and metadata we already have at our disposal
    yield f"""{json.dumps({
        "event": "sources",
        "data": {
            "sources": sources,
        },
    })}$$$\n"""

    # We return the chunks that constitute the content of the response message
    for chunk in generator:
        yield f"""{json.dumps({
            "event": "content",
            "data": {
                "content": chunk
            },
        })}$$$\n"""


@router.post(
    "/message",
    response_description="Answer user prompt request",
)
def process_message(user_prompt_request: UserPromptRequest):
    try:
        """Process the user prompt request and generate an accurate answer
        
        Args:
            user_prompt_request (UserPromptRequest): The data received from the client
            - workflow (str): The workflow
            - mode (str): The mode 'collection' or 'file'
            - collection_id (str, optional): The collection id
            - collection_name (str, optional): The collection name
            - index (str): The collection_id in case of 'collection' mode or the token in case of 'file' mode
            - message (str): The message
            - token (str): The token
        
        Returns:
            StreamingResponse: A stream of data containing the sources and the response message
            
        Raises:
            HTTPException
            CustomException
            
        """

        # We extract the relevant data into separate variables
        # We don't actually need that many fields, but it can be interesting for logging purposes
        index = user_prompt_request.index
        message = user_prompt_request.message
        workflow = user_prompt_request.workflow
  
        # Fixme: add proper workflow handling
        # We set up the RAG pipeline
        rag_pipeline = rag.get_rag_pipeline(
            collection_name=BASE_COLLECTION_NAME,
            model_names=MODELS,
            filters={
                # Depending on the mode ('collection' or 'file'), index is either the collection_id or the token
                "index": index
            },
            workflow=workflow,
        )

        # We execute our RAG pipeline
        # Check message for LLM security purpose
        if not sanitize_input(message=message):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while sanitizing input for LLM",
            )

        response = rag_pipeline.query(message, precision=PRECISION)

        # We extract the sources that helped generate the response
        sources = [
            {
                "id": n.id_,
                "content": n.text,
                "file": {
                    # Fixme: Some values are not always present, we'll comment them out for now
                    "name": n.metadata["filename"],
                    # "path": n.metadata["path"],
                    "type": n.metadata["filetype"]
                    if "filetype" in n.metadata.keys()
                    else "preprocessed",
                    # "index": n.metadata["index"],
                    # "page_number": n.metadata["page_number"],
                },
                "score": n.score
            }
            for n in response.source_nodes
        ]
        # We return a stream of data containing the sources and the response message
        return StreamingResponse(
            generate_user_prompt_response(response.response_gen, sources),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            }
        )
    except Exception as e:
        raise CustomException(
            message="Error while processing incoming message",
            original_exception=e
        )


@router.post(
    "/feedback",
    response_description="Create user feedback",
    status_code=status.HTTP_201_CREATED
)
async def create_user_feedback(
        user_feedback: UserFeedbackModel,
        response_model=SuccessResponse[UserFeedbackModel]
):
    """Create user feedback

    Args:
        user_feedback (UserFeedbackModel): The user feedback data
        - user_prompt_request (UserPromptRequest): The user prompt request
        - user_prompt_response (UserPromptResponse): The user prompt response
        - user_feedback (int): The user feedback

    Returns:
        SuccessResponse[UserFeedbackModel]: The user feedback instance created

    Raises:
        HTTPException

    """

    try:
        # We create a new user feedback instance
        new_user_feedback = UserFeedbackModel(
            user_prompt_request=user_feedback.user_prompt_request,
            user_prompt_response=user_feedback.user_prompt_response,
            user_feedback=user_feedback.user_feedback
        )

        # We clear confidential fields when in 'file' mode
        if user_feedback.user_prompt_request.mode == 'file':
            new_user_feedback.user_prompt_request.message = None
            new_user_feedback.user_prompt_response.sources = None
            new_user_feedback.user_prompt_response.content = None

        # We save the user feedback instance
        await new_user_feedback.create()

        return SuccessResponse(data=new_user_feedback)

    except Exception as e:
        raise CustomException(
            original_exception=HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while creating user feedback",
            )

        )
