import os

import qdrant_client

client = qdrant_client.QdrantClient(
    os.environ.get("QDRANT_ENDPOINT"),
)
async_client = qdrant_client.AsyncQdrantClient(
    os.environ.get("QDRANT_ENDPOINT")
)

BASE_COLLECTION_NAME = os.getenv('QDRANT_BASE_COLLECTION_NAME')
