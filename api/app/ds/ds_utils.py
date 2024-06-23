from typing import List, Any
from app.config.openai import client as openai_client
from llama_index.core.schema import NodeWithScore
from app.config.logger import logger

def compute_embedding(docs: List[str], model: str) -> List[Any]:
    """This function computes embeddings for a given list of texts

    Args:
        docs (List[str]): Input texts to embed
        model (str): Embedding model to used

    Returns:
        _type_: _description_
    """
    embeddings = openai_client.embeddings.create(model=model, input=docs)
    return [e.embedding for e in embeddings.data]



def node_parser(nodes: List[NodeWithScore]) -> str:
    context = ""
    for node in nodes:
        context += node.text + "\n\n"
    return context