import ast
import os

#MODELS = ast.literal_eval(os.getenv("MODELS"))
MODELS = {
    "embed_model" : os.getenv("MODELS_EMBED"),
    "llm_model" : os.getenv("MODELS_LLM")
}
PRECISION = os.getenv("RAG_PRECISION")
