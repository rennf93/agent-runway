def format_user_response(user: dict) -> dict:
    return {
        "id": user["id"],
        "display_name": user["name"].title(),
        "email": user["email"].lower(),
    }


def format_error_response(status: int, detail: str) -> dict:
    return {"error": {"status": status, "detail": detail}}
