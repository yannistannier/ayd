class CustomException(Exception):
    """Custom exception that encapsulates the original exception that occurred"""

    def __init__(self, original_exception: Exception, message: str = "CustomException occurred"):
        """Initialize the exception with the original one that occurred"""
        super().__init__(message)
        self.original_exception = original_exception