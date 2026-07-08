"""Shared fixtures for DapurKita backend tests.

Seeds synthetic users + sessions directly in Mongo since Emergent OAuth
cannot be exercised end-to-end in an automated test.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient


BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


def _make_user_and_token(db):
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    email = f"TEST_{user_id}@example.com"
    db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": "TEST User",
        "picture": None,
        "household_id": None,
        "created_at": datetime.now(timezone.utc),
    })
    token = uuid.uuid4().hex
    db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    return user_id, email, token


@pytest.fixture
def seeded_user(mongo_db):
    """Fresh user + session; cleaned up after test."""
    user_id, email, token = _make_user_and_token(mongo_db)
    yield {"user_id": user_id, "email": email, "token": token}
    # cleanup
    user = mongo_db.users.find_one({"user_id": user_id})
    hh_id = user.get("household_id") if user else None
    mongo_db.user_sessions.delete_many({"user_id": user_id})
    mongo_db.users.delete_many({"user_id": user_id})
    if hh_id:
        # only delete the household if this was the last member
        remaining = mongo_db.users.count_documents({"household_id": hh_id})
        if remaining == 0:
            mongo_db.households.delete_many({"id": hh_id})
            mongo_db.meal_plans.delete_many({"household_id": hh_id})
            mongo_db.fridge_inventories.delete_many({"household_id": hh_id})
            mongo_db.grocery_lists.delete_many({"household_id": hh_id})


@pytest.fixture
def seeded_user_b(mongo_db):
    user_id, email, token = _make_user_and_token(mongo_db)
    yield {"user_id": user_id, "email": email, "token": token}
    user = mongo_db.users.find_one({"user_id": user_id})
    hh_id = user.get("household_id") if user else None
    mongo_db.user_sessions.delete_many({"user_id": user_id})
    mongo_db.users.delete_many({"user_id": user_id})
    if hh_id:
        remaining = mongo_db.users.count_documents({"household_id": hh_id})
        if remaining == 0:
            mongo_db.households.delete_many({"id": hh_id})
            mongo_db.meal_plans.delete_many({"household_id": hh_id})
            mongo_db.fridge_inventories.delete_many({"household_id": hh_id})
            mongo_db.grocery_lists.delete_many({"household_id": hh_id})


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
