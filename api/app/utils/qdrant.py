from fastapi import UploadFile
from qdrant_client.http import models

from app.config.qdrant import client as qdrant_client, BASE_COLLECTION_NAME
from app.ds.parsing_loading_utils import ingest_data

MODEL_NAMES = {
    "embed_model": "text-embedding-3-small",
    "llm_model": "gpt-3.5-turbo",
    "fiab_llm_model": "gpt-3.5-turbo",
    "llm_judge": "gpt-3.5-turbo",
    "eval_generation_llm": "gpt-3.5-turbo",
}


def create_qdrant_collection_index(index: str):
    """Creates a new index in the qdrant collection

    Args:
        index (str): The index to create

    Returns:
        None
    """
    qdrant_client.create_payload_index(
        collection_name=BASE_COLLECTION_NAME,
        field_name=index,
        field_schema=models.PayloadSchemaType.KEYWORD,
    )


def ingest_file(index: str, file: UploadFile, filename: str = None, preprocessed: bool = False):
    """Ingest a file into the Qdrant vector store

    Args:
        index (str): User token
        file (UploadFile): File to ingest
        filename (str, optional): File name, defaults to file.filename
        preprocessed (bool, optional): Whether the file is already preprocessed

    Returns:
        None

    """

    ingest_data(
        filename=filename if filename else file.filename,
        data=file.file,
        index=index,
        embedding_model=MODEL_NAMES["embed_model"],
        fiab_model=MODEL_NAMES["fiab_llm_model"],
        apply_fiab=True,
        preprocessed=preprocessed
    )


def remove_qdrant_index(index: str):
    """Function to clean user session document on Qdrant

    Args:
        index (str): User token
    """
    qdrant_client.delete(
        collection_name=BASE_COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="index",
                        match=models.MatchValue(value=str(index)),
                    ),
                ],
            )
        ),
    )


def remove_files_from_qdrant_index(index: str, filename: str):
    """Removes a file from a specific qdrant index

    Args:
        index (str): The index
        filename (str): The filename

    Returns:
        None
    """

    qdrant_client.delete(
        collection_name=BASE_COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="index",
                        match=models.MatchValue(value=str(index)),
                    ),
                    models.FieldCondition(
                        key="filename",
                        match=models.MatchValue(value=str(filename)),
                    ),
                ],
            )
        ),
    )
