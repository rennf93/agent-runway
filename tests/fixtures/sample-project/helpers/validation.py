from fastapi import HTTPException


def validate_user_input(name: str, email: str) -> None:
    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")
