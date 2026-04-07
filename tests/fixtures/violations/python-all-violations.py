#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# This is a standalone comment
x = 1  # inline comment

import os  # noqa: F401
result = foo()  # type: ignore
bar()  # pylint: disable=no-member
baz()  # pragma: no cover
qux()  # fmt: off

print("debug output")

def clean_function():
    return True
