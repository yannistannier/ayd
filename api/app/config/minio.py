import os

from minio import Minio

client = Minio(
    endpoint=os.getenv("MINIO_ENDPOINT"),
    access_key=os.getenv("MINIO_ACCESS_KEY"),
    secret_key=os.getenv("MINIO_SECRET_KEY"),
    region="fr",
    secure=False,
)

COLLECTIONS_BUCKET_NAME = os.getenv("MINIO_COLLECTIONS_BUCKET_NAME")
