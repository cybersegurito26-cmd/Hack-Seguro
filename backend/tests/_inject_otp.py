"""Test helper: inject known OTP hash for a given email."""
import asyncio, sys, bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, timezone

async def main(email, code):
    c = AsyncIOMotorClient("mongodb://localhost:27017")
    db = c["hackseguro"]
    row = await db.otp_codes.find_one({"email": email, "used": False}, sort=[("created_at", -1)])
    if not row:
        print("NO_ROW")
        return
    h = bcrypt.hashpw(code.encode(), bcrypt.gensalt(rounds=10)).decode()
    await db.otp_codes.update_one(
        {"_id": row["_id"]},
        {"$set": {"code_hash": h, "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)}},
    )
    print("INJECTED")

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2]))
