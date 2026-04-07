from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}")
async def get_user(user_id: int):
    from services.users import get_user_by_id
    from helpers.formatting import format_user_response
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404)
    return format_user_response(user)


@router.get("/")
async def list_users():
    from services.users import list_all_users
    from helpers.formatting import format_user_response
    users = await list_all_users()
    return [format_user_response(u) for u in users]


@router.post("/")
async def create_user(name: str, email: str):
    from services.users import create_new_user
    from helpers.validation import validate_user_input
    validate_user_input(name, email)
    return await create_new_user(name, email)
