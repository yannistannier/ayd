import os
from logging import info

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.models.documents.collection import Collection
from app.models.documents.user_feedback import UserFeedback

# We instantiate the MongoDB client by connecting to our cluster
client = AsyncIOMotorClient(os.getenv('MONGODB_URI'))

# We retrieve the database we want to use
db = client.get_database(os.getenv('MONGODB_DATABASE_NAME'))


async def init():
    # Fixme: ensure connexion is ready before starting the app
    # We initialize Beanie to use the database and the models of our app
    await init_beanie(database=db, document_models=[Collection, UserFeedback])

    # We test the database connection
    ping_response = await db.command("ping")

    if int(ping_response["ok"]) != 1:
        raise Exception("Error while connecting to mongodb database")
    else:
        info("Successfully connected to mongodb database")
