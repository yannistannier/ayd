from fastapi import UploadFile
from minio.deleteobjects import DeleteObject

from app.config.minio import client as minio_client

token_pattern = r'^[a-zA-Z0-9]{16}-[a-zA-Z0-9]{16}$'


def remove_files_from_bucket(bucket_name: str, prefix: str):
    """Remove files from a bucket with a specific prefix

        Args:
            bucket_name (str): The bucket name
            prefix (str): The prefix to remove

        Returns:
            None

    """

    # We prepare our list of objects to remove
    files_to_delete = map(
        lambda x: DeleteObject(x.object_name),
        minio_client.list_objects(bucket_name, prefix, recursive=True),
    )

    # We proceed to files removal, and retrieve any errors
    errors = minio_client.remove_objects(bucket_name, files_to_delete)
    for error in errors:
        print("An error occurred whi deleting object", error)


def upload_file_to_bucket(bucket_name: str, object_name: str, file: UploadFile):
    """Upload a file to the bucket

    Args:
        bucket_name (str): The bucket name
        object_name (str): The object name
        file (UploadFile): The file to upload

    Returns:
        None

    """

    minio_client.put_object(
        bucket_name,
        object_name,
        file.file,
        file.size,
        file.content_type,
    )
