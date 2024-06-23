import os

from mlflow import MlflowClient

client = MlflowClient(tracking_uri=os.getenv("MLFLOW_URI"))
