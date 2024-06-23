from fastapi import APIRouter, HTTPException
from starlette import status

from ..data.settings import workflows
from ..exceptions.custom_exception import CustomException

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)


@router.get("/workflows")
async def get():
    """Return the list of available workflows

    Returns:
        list: The list of available workflows

    Raises:
        CustomException
    """
    try:
        return workflows
    except Exception:
        raise CustomException(
            original_exception=HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error while fetching workflows",
            )
        )
