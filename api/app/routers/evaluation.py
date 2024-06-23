import base64
import os
import secrets
import shutil
import tempfile
from typing import Annotated, List, Union, Dict
from urllib.parse import unquote
from skops.io import load
from qdrant_client.http import models
from app.config.minio import client as minio_client
from app.config.openai import client as openai_client
from app.config.qdrant import client as qdrant_client
from app.config.redis import client as redis_client
from fastapi import (
    APIRouter,
    Body,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
    Depends,
)
from fastapi.responses import StreamingResponse
from llama_index.core.vector_stores import FilterCondition, FilterOperator
from llama_index.core.vector_stores.types import (
    ExactMatchFilter,
    MetadataFilter,
    MetadataFilters,
)

from llama_index.llms.openai_like import OpenAILike
from app.ds.eval_pipeline import (
    CaradocEvalPipeline)
import app.ds.rag_pipeline as rag
from app.models.pipeline_evaluation_metrics import PipelineEvaluationMetrics
from app.models.eval_pipeline_request import EvalPipelineRequest
from app.dependencies.ai_models import get_eval_message_type_model
from app.config.mlflow import client as mlflow_client
from app.utils.mlflow import log_rag_metrics
from app.config.qdrant import BASE_COLLECTION_NAME
from app.config.rag import MODELS, PRECISION
router = APIRouter(
    prefix="/evaluation",
    tags=["evaluation"],
)

@router.post("/eval")
def eval_pipeline_on_collection(
    eval_request: EvalPipelineRequest, clf_pr=Depends(get_eval_message_type_model)
) -> Dict[str, float]:
    """This function allows to eval a workflow (pipeline RAG) on a collection database

    Args:
        request (EvalPipelineRequest): Request as a EvalPipelineRequest object
        clf_pr (_type_, optional): RAG request classifier. Defaults to Depends(get_eval_message_type_model).

    Returns:
        Dict[str, float]: RAG evaluation metrics
    """
    
    index = eval_request.index
    workflow = eval_request.workflow
    precision = PRECISION 
    params = {"workflow": workflow, "index": index, "precision": precision}
    # Get data
    data = qdrant_client.scroll(
        collection_name="demo",
        scroll_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="index", match=models.MatchValue(value=index)
                ),
            ]
        ),
        limit=2,
        with_payload=True,
        with_vectors=False,
    )[0]
    texts = [d.payload["text"] for d in data]
    ids = [d.id for d in data]
    # Get workflow
    filters = {"index": index}
    rag_pipeline = rag.get_rag_pipeline(
        workflow=workflow,
        collection_name=BASE_COLLECTION_NAME,
        model_names=MODELS,
        filters=filters,
    )
   
    # Get evaluator
   
    return  CaradocEvalPipeline(
            params=params,
            ids=ids,
            texts=texts,
            generation_model=MODELS['eval_generation_llm'],
            judge_model=MODELS['llm_judge'],
            embed_model=MODELS['embed_model'],
            rag_pipeline=rag_pipeline,
            clf_pr=clf_pr
        ).eval_pipeline()