import os
from abc import ABC, abstractmethod
from llama_index.core import VectorStoreIndex
from llama_index.core.prompts import PromptTemplate
from llama_index.core.vector_stores import FilterCondition, FilterOperator
from llama_index.core.vector_stores.types import (
    ExactMatchFilter,
    MetadataFilter,
    MetadataFilters,
)
from llama_index.llms.openai_like import OpenAILike
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core.query_pipeline import QueryPipeline, InputComponent, FnComponent
from llama_index.core import get_response_synthesizer
from llama_index.core.response_synthesizers import ResponseMode
from llama_index.core.schema import NodeWithScore
from app.config.openai import client as openai_client
import app.ds.ai_models as ai_models
from app.config.qdrant import client as qdrant_client, async_client as async_qdrant_client
from typing import Dict, Any, List
from app.config.prompts import prompts_config
from app.ds.ds_utils import node_parser
from app.config.openai import OPENAI_TYPE

def get_rag_pipeline(
    workflow: str,
    collection_name: str,
    filters: Dict[Any, Any],
    model_names, 
):
    """
    This function return a "RAG_pipeline" object for a given workflow
    """
    if workflow.lower() == "classique":
        return NaiveRAGPipeline(
            collection_name=collection_name,
            embed_model_name=model_names["embed_model"],
            llm_model_name=model_names["llm_model"],
            filters=filters,
        )
    elif workflow.lower() == "check":
        return CheckerRAGPipeline(
            collection_name=collection_name,
            embed_model_name=model_names["embed_model"],
            llm_model_name=model_names["llm_model"],
            filters=filters,
        )
    else:
        return {"Message": "Please Provide a correct workflow"}
class RAGPipeline(ABC):
    """
    An abstract class to represent a RAG pipeline.

    Methods
    -------
    retrieve():
        Allows to retrieve document for a given query in a given index
    query()
        Queries a rag pipeline for a query
    """
    @abstractmethod
    def query(self):
        pass
    @abstractmethod
    def retrieve(self):
        pass



class NaiveRAGPipeline(RAGPipeline):
    def __init__(
        self,
        collection_name: str,
        embed_model_name: str,
        llm_model_name: str,
        filters: dict,
    ) -> None:
        self.collection_name = collection_name
        
        if OPENAI_TYPE == "custom":
            self.embed_model = ai_models.CustomOpenAIEmbedding(
                openai_client=openai_client, model_name=embed_model_name
            )
        if OPENAI_TYPE == "openai":
            self.embed_model = OpenAIEmbedding(
                model=embed_model_name, 
                timeout=60
            )

        self.filters = filters
        self.params = prompts_config['rag']['classique'][llm_model_name]

        if OPENAI_TYPE == "custom":
            self.llm_model = OpenAILike(
                model=llm_model_name,
                max_tokens=self.params['max_tokens'],
                temperature=self.params["temperature"],
                top_p=self.params["top_p"], 
                timeout=600,
            )
        if OPENAI_TYPE == "openai":
            self.llm_model = OpenAI(model=llm_model_name,timeout=60,temperature=self.params["temperature"],top_p=self.params["top_p"])

    def get_index(self):
        vector_store = QdrantVectorStore(
            client=qdrant_client, collection_name=self.collection_name
        )

        llama_index_filters = MetadataFilters(
            filters=[
                MetadataFilter(key=key, value=value)
                for key, value in self.filters.items()
            ],
            condition=FilterCondition.AND,
        )
        index = VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
            embed_model=self.embed_model,
            filters=llama_index_filters,
        )
        return index

    def get_query_engine(self, precision: int = 5, streaming=True):
        index = self.get_index()
        llama_index_filters = MetadataFilters(
            filters=[
                MetadataFilter(key=key, value=value)
                for key, value in self.filters.items()
            ],
            condition=FilterCondition.AND,
        )
        query_engine = index.as_query_engine(
            llm=self.llm_model,
            filters=llama_index_filters,
            similarity_top_k=precision,
            streaming=streaming,
        )
        query_engine.update_prompts(
            {
                "response_synthesizer:text_qa_template": PromptTemplate(
                    self.params["prompt"]
                )
            }
        )
        return query_engine
    

    def query(self, message: str, precision: int = 5):
        query_engine = self.get_query_engine(precision=precision)
        return query_engine.query(message)
    
    
    def retrieve(self, message, precision : int = 5):
        retriever = self.get_index().as_retriever(similarity_top_k=precision)
        return retriever.retrieve(message)
    
class CheckerRAGPipeline(RAGPipeline):
    def __init__(
        self,
        collection_name: str,
        embed_model_name: str,
        llm_model_name: str,
        filters: dict,
    ) -> None:
        self.collection_name = collection_name
        if OPENAI_TYPE == "custom":
            self.embed_model = ai_models.CustomOpenAIEmbedding(
                openai_client=openai_client, model_name=embed_model_name
            )
        if OPENAI_TYPE == "openai":
            self.embed_model = OpenAIEmbedding(
                model=embed_model_name, 
                timeout=60
            )
        self.filters = filters
        self.qa_params = prompts_config['rag']['classique'][llm_model_name]
        self.check_params = prompts_config['rag']['check'][llm_model_name]
        if OPENAI_TYPE == "custom":
            self.llm_model = OpenAILike(
                model=llm_model_name,
                max_tokens=self.qa_params["max_tokens"],
                temperature=self.qa_params["temperature"],
                top_p=self.qa_params["top_p"],
                timeout=600,
            )
        if OPENAI_TYPE == "openai":
            self.llm_model = OpenAI(model=llm_model_name,timeout=60,temperature=self.qa_params["temperature"],top_p=self.qa_params["top_p"])

    def get_index(self):
        vector_store = QdrantVectorStore(
            client=qdrant_client, collection_name=self.collection_name
        )

        llama_index_filters = MetadataFilters(
            filters=[
                MetadataFilter(key=key, value=value)
                for key, value in self.filters.items()
            ],
            condition=FilterCondition.AND,
        )
        index = VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
            embed_model=self.embed_model,
            filters=llama_index_filters,
        )
        return index

    def get_query_engine(self, precision: int = 5, streaming=True):
        input_component = InputComponent()
        index = self.get_index()
        llama_index_filters = MetadataFilters(
            filters=[
                MetadataFilter(key=key, value=value)
                for key, value in self.filters.items()
            ],
            condition=FilterCondition.AND,
        )
        retriever = index.as_retriever(
            similarity_top_k=precision, filters=llama_index_filters
        )
        node_parsing_component = FnComponent(fn=node_parser, output_key="context_str")
        response_synthesizer = get_response_synthesizer(
            response_mode="compact",
            text_qa_template=PromptTemplate(self.qa_params["prompt"]),
            llm=self.llm_model,
            streaming=streaming,
        ).as_query_component()

        query_engine = QueryPipeline(
            modules={
                "input": input_component,
                "check_prompt_template": PromptTemplate(self.check_params["prompt"]),
                "retriever": retriever,
                "llm1": self.llm_model,
                "node_parser": node_parsing_component,
                "response_synthesizer": response_synthesizer,
            }
        )
        query_engine.add_chain(["input", "retriever"])
        query_engine.add_link("input", "check_prompt_template", dest_key="query_str")
        query_engine.add_link("retriever", "node_parser")
        query_engine.add_link(
            "node_parser", "check_prompt_template", dest_key="context_str"
        )
        query_engine.add_link("check_prompt_template", "llm1")
        query_engine.add_link("llm1", "response_synthesizer", dest_key="query_str")
        query_engine.add_link("retriever", "response_synthesizer", dest_key="nodes")
        return query_engine

    def query(self, message: str, precision: int = 5):
        query_engine = self.get_query_engine(precision=precision)
        return query_engine.run(query_str=message)
    
    def retrieve(self, message, precision : int = 5):
        retriever = self.get_index().as_retriever(similarity_top_k=precision)
        return retriever.retrieve(message)