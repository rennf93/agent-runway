USERS_DB = {}
NEXT_ID = 1


async def get_user_by_id(user_id: int):
    return USERS_DB.get(user_id)


async def list_all_users():
    return list(USERS_DB.values())


async def create_new_user(name: str, email: str):
    global NEXT_ID
    user = {"id": NEXT_ID, "name": name, "email": email}
    USERS_DB[NEXT_ID] = user
    NEXT_ID += 1
    return user
