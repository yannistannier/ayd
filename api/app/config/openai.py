import os

from openai import AsyncOpenAI
from openai import AzureOpenAI, OpenAI

if os.environ.get("OPENAI_API_BASE"):
    client = AzureOpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
        azure_endpoint=os.environ.get("OPENAI_API_BASE"),
        api_version=os.environ.get("OPENAI_API_VERSION"),
    )
    async_client = AsyncOpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
        base_url=os.environ.get("OPENAI_API_BASE"),
    )
    OPENAI_TYPE="azure"
else:
    client = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY")
    )
    async_client = AsyncOpenAI(
        api_key=os.environ.get("OPENAI_API_KEY")
    )
    OPENAI_TYPE="openai"
