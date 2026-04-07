#!/usr/bin/env python3

from typing import Optional


def add(a: int, b: int) -> int:
    return a + b


def get_user_name(user: dict) -> Optional[str]:
    return user.get("name")
