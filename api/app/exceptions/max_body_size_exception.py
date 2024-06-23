# Custom exception for handling maximum request body size when exceeded
class MaxBodySizeException(Exception):
    def __init__(self, body_size: str):
        """Initialize the exception with the size of the request body that exceeded the limit."""
        self.body_size = body_size
