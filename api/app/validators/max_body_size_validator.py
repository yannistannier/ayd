from app.exceptions.max_body_size_exception import MaxBodySizeException


class MaxBodySizeValidator:
    def __init__(self, max_size: int):
        """
        We initialize the validator with the maximum allowed size
        """

        self.body_size = 0
        self.max_size = max_size

    def __call__(self, chunk: bytes):
        """
        The data is received in chunk
        We need to run validation after each received chunk, once we accumulate them
        The 'MaxBodySizeException' exception will be raised if the body size exceeds the maximum limit
        """

        self.body_size += len(chunk)
        if self.body_size > self.max_size:
            raise MaxBodySizeException(body_size=str(self.body_size))
