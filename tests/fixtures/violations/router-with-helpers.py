from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/users", tags=["users"])


def format_user_for_response(user: dict) -> dict:
    return {
        "id": user["id"],
        "display_name": user["name"].title(),
        "email": user["email"].lower(),
    }


def validate_user_input(name: str, email: str) -> bool:
    if not name or len(name) < 2:
        return False
    if "@" not in email:
        return False
    return True


@router.get("/{user_id}")
async def get_user(user_id: int):
    from services.users import get_user_by_id
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404)
    return format_user_for_response(user)


@router.get("/")
async def list_users():
    from services.users import list_all_users
    users = await list_all_users()
    return [format_user_for_response(u) for u in users]
