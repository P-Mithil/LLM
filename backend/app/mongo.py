from __future__ import annotations

from functools import lru_cache

from flask import current_app
from pymongo import ASCENDING, MongoClient


@lru_cache(maxsize=1)
def mongo_client() -> MongoClient:
    return MongoClient(current_app.config["MONGODB_URI"])


def db():
    return mongo_client()[current_app.config["MONGODB_DB"]]


def users_col():
    return db()["users"]


def classrooms_col():
    return db()["classrooms"]


def enrollments_col():
    return db()["enrollments"]


def assignments_col():
    return db()["assignments"]


def submissions_col():
    return db()["submissions"]


def messages_col():
    return db()["messages"]

def class_materials_col():
    return db()["class_materials"]


def ensure_indexes():
    """
    Create Mongo indexes used by the app.
    Safe to call on startup.
    """
    users_col().create_index([("email", ASCENDING)], unique=True)

    classrooms_col().create_index([("class_code", ASCENDING)], unique=True)
    classrooms_col().create_index([("faculty_id", ASCENDING)])

    enrollments_col().create_index([("student_id", ASCENDING), ("classroom_id", ASCENDING)], unique=True)
    enrollments_col().create_index([("classroom_id", ASCENDING)])

    assignments_col().create_index([("classroom_id", ASCENDING)])

    submissions_col().create_index([("assignment_id", ASCENDING), ("student_id", ASCENDING)], unique=True)
    submissions_col().create_index([("assignment_id", ASCENDING)])

    messages_col().create_index([("classroom_id", ASCENDING), ("timestamp", ASCENDING)])

    class_materials_col().create_index([("classroom_id", ASCENDING), ("created_at", ASCENDING)])
    class_materials_col().create_index([("classroom_id", ASCENDING), ("kind", ASCENDING)])

