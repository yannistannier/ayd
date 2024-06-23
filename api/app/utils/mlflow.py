from mlflow import MlflowClient
from app.config.mlflow import client as mlflow_client
import mlflow
import os
from typing import Dict, Any
from loguru import logger

def create_rag_experiment() -> bool:
    """This function allows to create the experiment for CARADOC app

    Returns:
        bool: success flag
    """
    # Check if the experiment rag_caradoc already exist
    all_experiments_name = [e.name for e in mlflow_client.search_experiments()]
    if "caradoc_eval" in all_experiments_name:
        return True
    else:
        try:
            # Create rag experiment
            experiment_description = (
                "This is an experiment to log Caradoc RAG application evaluation"
            )

            experiment_tags = {
                "project_name": "CARADOC",
                "mlflow.note.content": experiment_description,
            }

            rag_caradoc_experiment = mlflow_client.create_experiment(
                name="caradoc_eval", tags=experiment_tags
            )
            return True
        except Exception as e:
            logger.error(e)
            return False


def log_rag_metrics(run_name: str, params: Dict[str, Any], metrics: Dict[str, float]) -> None:
    """This function logs rag metrics into mlflow experiment

    Args:
        run_name (str): name to display into mlflow UI
        params (Dict[str, Any]): params to log into mlflow
        metrics (Dict[str, float]): evaluation metrics to log 
    """
    # Create experiement if it doesnot
    flag = create_rag_experiment()
    if flag:
        mlflow.set_tracking_uri(os.getenv("MLFLOW_URI"))
        mlflow.set_experiment("caradoc_eval")
        with mlflow.start_run(run_name=run_name) as run:
            # Log run params
            try:
                mlflow.log_params(params)
                # Log metrics
                for key, val in metrics.items():
                    mlflow.log_metric(key, val)
            except Exception as e:
                logger.error(e)
                raise (e)

    else:
        logger.error("Impossible to create and connect to the mlflow CARADOC experiment")
        raise Exception("Impossible to create and connect to the mlflow CARADOC experiment")
