from llm_guard import scan_prompt, scan_output
from llm_guard.input_scanners import (
    PromptInjection,
    TokenLimit,
    Toxicity,
    BanTopics,
    InvisibleText,
)


def sanitize_input(message: str) -> str | bool:
    """Controls user's input  using LLM guard
    Args:
        text (str): User's input query

    Returns:
        str | bool : Filter on LLM_guard 
    """
    input_scanners = [
        TokenLimit(limit=512),
        InvisibleText(),
    ]
    sanitize_message, result_valid, result_score = scan_prompt(input_scanners, message)
    if any(not result for result in result_valid.values()):
        return False
    else:
        return True


def sanitize_input_docs(text: str) -> str | bool :
    """Controls user's input docs using LLM guard
    Args:
        text (str): document as a text

    Returns:
        str | bool : Filter on LLM_guard 
    """
    # Initialize scanners
    input_scanners = [InvisibleText()]
    sanitize_doc, result_valid, result_score = scan_prompt(input_scanners, text)
    if any(not result for result in result_valid.values()):
        # If the
        return False
    else:
        return sanitize_doc
