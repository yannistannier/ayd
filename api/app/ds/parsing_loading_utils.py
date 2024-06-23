import os
import re
import uuid
from io import StringIO, BytesIO
from tempfile import SpooledTemporaryFile
from typing import List

import enchant
import pandas as pd
from fastapi import HTTPException, status
from pdfminer.high_level import extract_text_to_fp
from pdfminer.layout import LAParams
from qdrant_client.http import models
from unstructured.partition.docx import partition_docx
from unstructured.partition.html import partition_html
from unstructured.partition.md import partition_md
from unstructured.partition.odt import partition_odt
from unstructured.partition.text import partition_text
from unstructured.staging.base import convert_to_dataframe

import app.ds.ds_utils as ds_utils
from app.config.logger import logger
from app.config.openai import client as openai_client
from app.config.prompts import prompts_config
from app.config.qdrant import BASE_COLLECTION_NAME
from app.config.qdrant import client as qdrant_client
from app.utils.input_sanitizers import sanitize_input_docs

CHUNKING_PARAMS = {
    "max_characters": 1024,
    "overlap": 128,
    "overlap_all": True,
    "chunking_strategy": "by_title"
}


def load_data_from_file(filename: str, data: SpooledTemporaryFile) -> pd.DataFrame:
    """This function allows to load different type of files

    Supported files format : pdf, text

    Args:
        filename (str): filename to get extension
        data (SpooledTemporaryFile): PDF Data from uploaded file


    Returns:
        Parsing elements from unstructured

    """
    ext = os.path.splitext(filename)[-1].lower()
    if ext == ".pdf":
        document = parsing_pdf(data)
    elif ext == ".html":
        document = partition_html(
            file=data,
            max_characters=CHUNKING_PARAMS["max_characters"],
            overlap=CHUNKING_PARAMS['overlap'],
            chunking_strategy=CHUNKING_PARAMS["chunking_strategy"],
            overlap_all=CHUNKING_PARAMS["overlap_all"],
        )
    elif ext == ".txt":
        document = partition_text(
            file=data,
            url=None,
            max_characters=CHUNKING_PARAMS["max_characters"],
            overlap=CHUNKING_PARAMS['overlap'],
            chunking_strategy=CHUNKING_PARAMS["chunking_strategy"],
            overlap_all=CHUNKING_PARAMS["overlap_all"],
        )
    elif ext == ".odt":
        document = partition_odt(
            file=data,
            url=None,
            max_characters=CHUNKING_PARAMS["max_characters"],
            overlap=CHUNKING_PARAMS['overlap'],
            chunking_strategy=CHUNKING_PARAMS["chunking_strategy"],
            overlap_all=CHUNKING_PARAMS["overlap_all"],
        )
    elif ext == ".docx":
        document = partition_docx(
            file=data,
            url=None,
            max_characters=CHUNKING_PARAMS["max_characters"],
            overlap=CHUNKING_PARAMS['overlap'],
            chunking_strategy=CHUNKING_PARAMS["chunking_strategy"],
            overlap_all=CHUNKING_PARAMS["overlap_all"],
        )
    elif ext == ".md":
        document = partition_md(
            file=data,
            url=None,
            max_characters=CHUNKING_PARAMS["max_characters"],
            overlap=CHUNKING_PARAMS['overlap'],
            chunking_strategy=CHUNKING_PARAMS["chunking_strategy"],
            overlap_all=CHUNKING_PARAMS["overlap_all"],
        )

    return document


def parsing_pdf(data: SpooledTemporaryFile):
    """This function makes a parsing of pdf by using a intermediate step by parsing parsing pdf as HTML files

    Args:
        data (SpooledTemporaryFile): PDF Data from uploaded file

    Returns:
        Parsing elements from unstructured
    """

    output_string = StringIO()
    extract_text_to_fp(
        data, output_string, laparams=LAParams(), output_type="html", codec=None
    )
    content = output_string.getvalue().strip()
    document = partition_html(
        text=content,
        max_characters=CHUNKING_PARAMS["max_characters"],
        overlap=CHUNKING_PARAMS['overlap'],
        chunking_strategy=CHUNKING_PARAMS["chunking_strategy"],
        overlap_all=CHUNKING_PARAMS["overlap_all"],
    )
    return document


def split_dataframe(df: pd.DataFrame, chunk_size: int = 100) -> List[pd.DataFrame]:
    """This function split dataframe for embedding computation

    Args:
        df (pd.DataFrame): Input dataframe containing text to embed
        chunk_size (int, optional): size of each partition. Defaults to 100.

    Returns:
        List[pd.DataFrame]: Splited dataframe
    """
    chunks = list()
    num_chunks = len(df) // chunk_size + 1
    for i in range(num_chunks):
        chunks.append(df[i * chunk_size: (i + 1) * chunk_size])
    return chunks


def fiab_document(texts: List[str], model: str) -> List[str]:
    """This function increase parsing quality by using LLM to correct potential mistakes

    Args:
        texts (List[str]): Input texts
        model (str, optional): LLM used for the "parsing". Defaults to "mistral-7b-awq".

    Returns:
        List[str]: _description_
    """
    prompt = prompts_config['fiab']['process'][model]['prompt']
    inputs = [prompt.format(document=t) for t in texts]
    # output = openai_client.completions.create(
    #     prompt=inputs, model=model, max_tokens=1024, temperature=0.0, top_p=0.01
    # )
    # return [re.sub(r"Document fiabilisé:?", "", t.text) for t in output.choices]
    outputs = []
    for input in inputs:
        output = openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": input}
            ]
        )
        outputs.append( output.choices[0])
    return [re.sub(r"Document fiabilisé:?", "", t.message.content) for t in outputs]


def check_voc(text: str, custom_vocabulary: List[str] = [], threshold: float = 0.8) -> bool:
    """Check if the text contains a ratio of french words

    Args:
        text (str): Input text for checking
        custom_vocabulary : Additional vocabulary to test
        threshold (float, optional): Minimal ration of french words. Defaults to 0.8.

    Returns:
        bool: a Boolean to indicates the "quality" of the text
    """
    fr_voc = enchant.Dict("fr_FR")
    en_voc = enchant.Dict("en_US")
    score = 0
    if len(text) > 0:
        for w in text.split():
            if fr_voc.check(w.lower()):
                score += 1
            elif en_voc.check(w.lower()):
                score += 1
            elif w.lower() in custom_vocabulary:
                score += 1
        mean_score = score / len(text.split())
        if mean_score < threshold:
            return True
        else:
            return False
    else:
        return False


def clean_text(text: str) -> str:
    """This function clean text of extraspace

    Args:
        text (str): Input text for cleaning

    Returns:
        str: clean text
    """
    return re.sub("\n", " \n", text)


def ingest_data(
        filename: str,
        data: SpooledTemporaryFile,
        index: str,
        embedding_model: str,
        fiab_model: str,
        apply_fiab: bool = False,
        preprocessed: bool = False
):
    """This function ingest data into Qdrant database by applying special parsing for a given type of document.
    It applies also LLM reliability to increase parsing quality

    Args:
        filename (str): The name of the uploaded file
        data (SpooledTemporaryFile): Data associated to the uploaded file
        index (str): index of the user or the "collection"
        generate_for_eval (bool, optional): Generation of question answer. This functionnality is only for admin purpose. Defaults to False.
        apply_fiab (bool, optional): Parameter to activate reliability. Defaults to False
        preprocess (boon optional)
    """
    data.seek(0)
    logger.info("Ingestion step 1 : Parsing")
    if preprocessed or os.path.splitext(filename)[-1].lower() == ".csv":
        if os.path.splitext(filename)[-1].lower() == ".csv":
            buffer = BytesIO(data.read())
            document = pd.read_csv(buffer)
            document = document.dropna()
        else:
            logger.error("Only CSV are accepted as preprocess file")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only CSV are accepted as preprocess file",
            )
    else:
        document = convert_to_dataframe(
            load_data_from_file(filename=filename, data=data)
        )
        if "filename" not in document.columns:
            document["filename"] = filename
        logger.info("Ingestion step 2 : Reliability")
        document["text"] = document.text.apply(clean_text)
        # Check document input
        document["security_check"] = document.text.apply(sanitize_input_docs)
        if apply_fiab:
            document["need_fiab"] = document.text.apply(check_voc)
            to_fiab = document[document["need_fiab"]]
            if len(to_fiab) > 0:
                to_fiab["text"] = fiab_document(
                    to_fiab.text.to_list(), model=fiab_model
                )
                to_keep = document[~document["need_fiab"]]
                document = pd.concat((to_fiab, to_keep))
    logger.info("Step 2 : Recording")
    logger.info(document)
    chunks = split_dataframe(document, chunk_size=100)
    for chunk in chunks:
        if len(chunk) > 0:
            record_in_qdrant(df=chunk, embedding_model=embedding_model, index=index, preprocessed=preprocessed)


def record_in_qdrant(df: pd.DataFrame, embedding_model: str, index: str, preprocessed: bool):
    """Record a dataframe into Qdrant database with its embedding

    Args:
        df (pd.DataFrame): Input Dataframe
        embedding_model (str): Model for embedding computing
        index (str): index of the documents (persistent database or not)
        preprocessed (bool)

    """
    if "text" not in df.columns:
        raise ValueError("Text must be in df columns")
    df["index"] = index
    df = df.reset_index(drop=True)  # Sync for the loop
    text = df.text.to_list()
    embs = ds_utils.compute_embedding(text, model=embedding_model)
    columns_to_keep = df.columns if preprocessed else ['text', 'element_id', 'index', 'filetype', 'filename']
    df_dict = [row.to_dict() for _, row in df[columns_to_keep].iterrows()]
    docs = [
        models.PointStruct(
            id=str(uuid.uuid4()),
            vector=embs[i],
            payload=df_dict[i],
        )
        for i in range(len(df_dict))
    ]
    operation_info = qdrant_client.upsert(
        collection_name=BASE_COLLECTION_NAME, wait=True, points=docs
    )
    if operation_info.status.value != "completed":
        logger.error("Upload failed")
        raise Exception("Upload failed")
