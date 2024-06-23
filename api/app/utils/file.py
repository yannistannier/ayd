from fastapi import UploadFile as _UploadFile


class UploadFile(_UploadFile):
    """Patches `fastapi.UploadFile` due to buffer close issue.

    See the related GitHub issue:
    https://github.com/tiangolo/fastapi/issues/10857
    """

    def __init__(self, upload_file: _UploadFile) -> None:
        """Wraps and mutates input `fastapi.UploadFile`.

        Swaps `close` method on the input instance, so it's a no-op when called
        by the framework. Adds `close` method of input as `_close` here, to be
        called later with overridden `close` method.
        """
        self.filename = upload_file.filename
        self.file = upload_file.file
        self.size = upload_file.size
        self.headers = upload_file.headers

        _close = upload_file.close
        setattr(upload_file, "close", self._close)
        setattr(self, "_close", _close)

    async def _close(self) -> None:
        pass

    async def close(self) -> None:  # noqa: D102
        await self._close()
