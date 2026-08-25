from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.db.models import User

router = APIRouter()


@router.get("/credits")
async def get_credits(user: User = Depends(get_current_user)):
    return {"balance": user.credits_balance}
