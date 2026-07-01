"""MongoDB connection — single source of truth for the `db` handle.

Any module that needs to query Mongo imports `db` from here. There is no
fallback DB or in-memory shim — if Mongo is unreachable, the app fails loudly
on first query (intentional).
"""
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def close_db() -> None:
    client.close()
