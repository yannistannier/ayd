from typing import Any, List

from llama_index.core.bridge.pydantic import PrivateAttr
from llama_index.core.embeddings import BaseEmbedding


class CustomOpenAIEmbedding(BaseEmbedding):
    """Embedding model class for LlamaIndex

    Args:
        model_name(str) : name of embedding model
        openai_client : client to connect to openai API (self-hosted model)
    """

    _model_name: str = PrivateAttr()
    _openai_client = PrivateAttr()

    def __init__(
        self,
        openai_client,
        model_name: str,
        **kwargs: Any,
    ) -> None:
        self._model_name = model_name
        self._openai_client = openai_client
        super().__init__(**kwargs)

    @classmethod
    def class_name(cls) -> str:
        return "CustomOpenAIEmbedding"

    async def _aget_query_embedding(self, query: str) -> List[float]:
        return self._get_query_embedding(query)

    def _get_query_embedding(self, query: str) -> List[float]:
        embeddings = self._openai_client.embeddings.create(
            input=query, model=self._model_name  # model = "deployment_name".
        )
        return embeddings.data[0].embedding

    def _get_text_embedding(self, text: str) -> List[float]:
        embeddings = self._openai_client.embeddings.create(
            input=text, model=self._model_name  # model = "deployment_name".
        )
        return embeddings.data[0].embedding

    def _get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        embeddings = self._openai_client.embeddings.create(
            input=texts, model=self._model_name  # model = "deployment_name".
        )
        embs = [e.embedding for e in embeddings.data]
        return embs

    async def _aget_query_embedding(self, query: str) -> List[float]:
        return self._get_query_embedding(query)

    async def _aget_text_embedding(self, text: str) -> List[float]:
        return self._get_text_embedding(text)
