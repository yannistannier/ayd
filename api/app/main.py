import logging
import traceback
from contextlib import asynccontextmanager

import nltk
from fastapi import FastAPI

from app.config.logger import logger as custom_logger
from app.config.mongo import init as init_mongo, client as mongo_client
from .dependencies.ai_models import init_eval_message_type_model
from .exceptions.custom_exception import CustomException
from .routers import chat, settings, collections, evaluation

# PASS IN ENV VARIABLE



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to mongo
    await init_mongo()

    # Load the ML model
    init_eval_message_type_model(model_path="ai_models/clf_pr.skops")

    yield

    mongo_client.close()


def create_app() -> FastAPI:
    """Returns an FastAPI app with a custom logger

    Returns:
        FastAPI: _description_
    """
    app = FastAPI(lifespan=lifespan, debug=True)
    app.logger = custom_logger
    app.include_router(settings.router)
    app.include_router(chat.router)
    app.include_router(collections.router)
    app.include_router(evaluation.router)

    return app


app = create_app()
