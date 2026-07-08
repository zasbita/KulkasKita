from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import string
import random
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ---------- Utilities ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}" if prefix else uuid.uuid4().hex[:12]


def gen_invite_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def normalize_dt(dt) -> datetime:
    if dt is None:
        return dt
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ---------- Models ----------
class SessionRequest(BaseModel):
    session_id: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    household_id: Optional[str] = None


class HouseholdCreate(BaseModel):
    name: str


class HouseholdJoin(BaseModel):
    invite_code: str


class HouseholdOut(BaseModel):
    id: str
    name: str
    invite_code: str
    members: List[dict] = []


class FridgeItemCreate(BaseModel):
    item_name: str


class FridgeItem(BaseModel):
    id: str
    household_id: str
    item_name: str
    created_at: datetime


class MealPlanCreate(BaseModel):
    date: str  # ISO date YYYY-MM-DD
    meal_type: str  # Sarapan / Makan Siang / Makan Malam
    menu_name: str
    ingredients: List[str] = []


class MealPlanUpdate(BaseModel):
    menu_name: Optional[str] = None
    ingredients: Optional[List[str]] = None


class MealPlan(BaseModel):
    id: str
    household_id: str
    date: str
    meal_type: str
    menu_name: str
    ingredients: List[str] = []
    is_archived: bool = False
    week_start: str
    created_at: datetime


class GroceryItemCreate(BaseModel):
    item_name: str
    category: Optional[str] = "Lain-lain"


class GroceryItem(BaseModel):
    id: str
    household_id: str
    item_name: str
    category: str
    is_bought: bool
    is_archived: bool
    created_at: datetime


class GroceryToggle(BaseModel):
    is_bought: bool


class MasterRecipe(BaseModel):
    menu_name: str
    suggested_ingredients: List[str]


class ArchivedWeek(BaseModel):
    week_start: str
    menu_count: int
    menus: List[dict]


# ---------- Auth helpers ----------
async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    if normalize_dt(session.get("expires_at")) < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_household(user: dict) -> dict:
    if not user.get("household_id"):
        raise HTTPException(status_code=400, detail="User has no household")
    hh = await db.households.find_one({"id": user["household_id"]}, {"_id": 0})
    if not hh:
        raise HTTPException(status_code=404, detail="Household not found")
    return hh


# ---------- Category classification ----------
CATEGORY_MAP = {
    "Sayuran": [
        "kacang panjang", "bayam", "kangkung", "jagung", "wortel", "kentang", "tomat",
        "timun", "sawi", "brokoli", "kol", "kubis", "terong", "buncis", "labu",
        "asam jawa", "selada", "daun singkong", "pare", "jamur", "seledri", "daun bawang",
        "melinjo", "nangka muda", "papaya muda", "rebung", "toge", "tauge",
    ],
    "Bumbu Dapur": [
        "bawang merah", "bawang putih", "cabai", "cabe", "kunyit", "jahe", "laos",
        "lengkuas", "kemiri", "ketumbar", "merica", "lada", "garam", "gula",
        "kecap", "minyak", "terasi", "daun salam", "daun jeruk", "sereh", "serai",
        "jeruk nipis", "asam", "santan", "kapulaga", "kayu manis", "pala",
    ],
    "Daging/Protein": [
        "ayam", "daging sapi", "sapi", "ikan", "telur", "tahu", "tempe", "udang",
        "kambing", "bebek", "cumi", "ati ampela", "bakso", "sosis",
    ],
    "Kebutuhan Rumah": [
        "sabun", "tisu", "popok", "deterjen", "shampoo", "sampo", "pasta gigi",
        "sikat gigi", "pembersih", "pewangi", "kertas", "plastik",
    ],
}


def classify_ingredient(name: str) -> str:
    n = name.lower().strip()
    for cat, kws in CATEGORY_MAP.items():
        for kw in kws:
            if kw in n:
                return cat
    return "Lain-lain"


# ---------- Seed data ----------
MASTER_RECIPES_SEED = [
    ("Sayur Asem", ["Kacang Panjang", "Jagung", "Labu Siam", "Melinjo", "Asam Jawa", "Bawang Merah", "Bawang Putih", "Cabai Merah"]),
    ("Rendang", ["Daging Sapi", "Santan", "Bawang Merah", "Bawang Putih", "Cabai Merah", "Serai", "Daun Jeruk", "Kunyit", "Jahe", "Lengkuas"]),
    ("Soto Ayam", ["Ayam", "Bawang Merah", "Bawang Putih", "Kunyit", "Jahe", "Daun Salam", "Serai", "Daun Jeruk", "Toge", "Daun Bawang"]),
    ("Nasi Goreng", ["Bawang Merah", "Bawang Putih", "Cabai", "Kecap", "Telur", "Ayam", "Daun Bawang"]),
    ("Gado-Gado", ["Kacang Tanah", "Tahu", "Tempe", "Kangkung", "Toge", "Kentang", "Telur", "Timun"]),
    ("Sop Ayam", ["Ayam", "Wortel", "Kentang", "Daun Bawang", "Seledri", "Bawang Putih", "Bawang Merah", "Merica"]),
    ("Tumis Kangkung", ["Kangkung", "Bawang Putih", "Cabai", "Terasi"]),
    ("Rawon", ["Daging Sapi", "Kluwek", "Bawang Merah", "Bawang Putih", "Kemiri", "Serai", "Daun Jeruk", "Toge"]),
    ("Ayam Goreng", ["Ayam", "Bawang Putih", "Kunyit", "Ketumbar", "Garam"]),
    ("Sambal Goreng Tempe", ["Tempe", "Cabai Merah", "Bawang Merah", "Bawang Putih", "Daun Salam", "Kecap"]),
    ("Opor Ayam", ["Ayam", "Santan", "Bawang Merah", "Bawang Putih", "Kemiri", "Ketumbar", "Serai", "Daun Salam"]),
    ("Gulai Kambing", ["Kambing", "Santan", "Bawang Merah", "Bawang Putih", "Cabai Merah", "Kunyit", "Jahe", "Serai"]),
    ("Sate Ayam", ["Ayam", "Kacang Tanah", "Kecap", "Bawang Merah", "Cabai"]),
    ("Bakso", ["Daging Sapi", "Bawang Putih", "Merica", "Daun Bawang", "Seledri"]),
    ("Capcay", ["Wortel", "Sawi", "Kembang Kol", "Brokoli", "Bawang Putih", "Kecap"]),
    ("Perkedel Kentang", ["Kentang", "Daging Sapi", "Bawang Merah", "Bawang Putih", "Telur", "Daun Bawang"]),
    ("Mie Goreng", ["Mie", "Bawang Merah", "Bawang Putih", "Cabai", "Kecap", "Telur", "Sawi"]),
    ("Ikan Bakar", ["Ikan", "Kecap", "Jeruk Nipis", "Bawang Merah", "Bawang Putih", "Cabai"]),
    ("Tumis Buncis", ["Buncis", "Bawang Putih", "Cabai", "Wortel"]),
    ("Semur Daging", ["Daging Sapi", "Kecap", "Bawang Merah", "Bawang Putih", "Kayu Manis", "Pala", "Kentang"]),
]


def week_start_of(date_str: str) -> str:
    """Return Monday of the week (YYYY-MM-DD) for a given ISO date string."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.households.create_index("id", unique=True)
    await db.households.create_index("invite_code", unique=True)
    await db.master_recipes.create_index("menu_name", unique=True)
    await db.meal_plans.create_index([("household_id", 1), ("week_start", 1)])
    await db.fridge_inventories.create_index("household_id")
    await db.grocery_lists.create_index("household_id")

    # Seed master recipes
    existing = await db.master_recipes.count_documents({})
    if existing < len(MASTER_RECIPES_SEED):
        for menu, ings in MASTER_RECIPES_SEED:
            await db.master_recipes.update_one(
                {"menu_name": menu},
                {"$set": {"menu_name": menu, "suggested_ingredients": ings}},
                upsert=True,
            )
        logger.info("Seeded master recipes")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------- Auth routes ----------
@api_router.post("/auth/session")
async def create_session(payload: SessionRequest):
    """Exchange Emergent session_id for user info + session_token, then persist."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Emergent session")
    data = r.json()
    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "household_id": None,
            "created_at": now_utc(),
        })

    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": expires_at,
            "created_at": now_utc(),
        }},
        upsert=True,
    )

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {
        "session_token": session_token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "household_id": user.get("household_id"),
        },
    }


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "household_id": user.get("household_id"),
    }


@api_router.post("/auth/logout")
async def logout(request: Request, user: dict = Depends(get_current_user)):
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Household routes ----------
@api_router.post("/household/create")
async def create_household(payload: HouseholdCreate, user: dict = Depends(get_current_user)):
    if user.get("household_id"):
        raise HTTPException(status_code=400, detail="User already in a household")
    # Generate unique invite code
    for _ in range(10):
        code = gen_invite_code()
        if not await db.households.find_one({"invite_code": code}):
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate invite code")
    hh_id = f"hh_{uuid.uuid4().hex[:12]}"
    hh = {
        "id": hh_id,
        "name": payload.name.strip() or "Rumah Kami",
        "invite_code": code,
        "created_at": now_utc(),
    }
    await db.households.insert_one(hh)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"household_id": hh_id}})
    return {"id": hh_id, "name": hh["name"], "invite_code": code}


@api_router.post("/household/join")
async def join_household(payload: HouseholdJoin, user: dict = Depends(get_current_user)):
    if user.get("household_id"):
        raise HTTPException(status_code=400, detail="Sudah bergabung dengan household lain")
    code = payload.invite_code.strip().upper()
    hh = await db.households.find_one({"invite_code": code}, {"_id": 0})
    if not hh:
        raise HTTPException(status_code=404, detail="Kode undangan tidak ditemukan")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"household_id": hh["id"]}})
    return {"id": hh["id"], "name": hh["name"], "invite_code": hh["invite_code"]}


@api_router.get("/household/me")
async def my_household(user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    members_cur = db.users.find({"household_id": hh["id"]}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1})
    members = await members_cur.to_list(50)
    return {
        "id": hh["id"],
        "name": hh["name"],
        "invite_code": hh["invite_code"],
        "members": members,
    }


@api_router.post("/household/leave")
async def leave_household(user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"household_id": None}})
    return {"ok": True}


# ---------- Master recipes ----------
@api_router.get("/recipes/search")
async def search_recipes(q: str = "", user: dict = Depends(get_current_user)):
    q = q.strip()
    if not q:
        cur = db.master_recipes.find({}, {"_id": 0}).limit(20)
        return await cur.to_list(20)
    cur = db.master_recipes.find(
        {"menu_name": {"$regex": q, "$options": "i"}},
        {"_id": 0},
    ).limit(10)
    return await cur.to_list(10)


# ---------- Fridge ----------
@api_router.get("/fridge")
async def list_fridge(user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    cur = db.fridge_inventories.find({"household_id": hh["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(500)


@api_router.post("/fridge")
async def add_fridge(payload: FridgeItemCreate, user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    name = payload.item_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama bahan tidak boleh kosong")
    item = {
        "id": f"fr_{uuid.uuid4().hex[:12]}",
        "household_id": hh["id"],
        "item_name": name,
        "created_at": now_utc(),
    }
    await db.fridge_inventories.insert_one(item)
    item.pop("_id", None)
    return item


@api_router.delete("/fridge/{item_id}")
async def delete_fridge(item_id: str, user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    res = await db.fridge_inventories.delete_one({"id": item_id, "household_id": hh["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    return {"ok": True}


# ---------- Meal Plans ----------
@api_router.get("/meal-plans")
async def list_meal_plans(week_start: Optional[str] = None, user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    query = {"household_id": hh["id"], "is_archived": False}
    if week_start:
        query["week_start"] = week_start
    cur = db.meal_plans.find(query, {"_id": 0}).sort("date", 1)
    return await cur.to_list(200)


@api_router.post("/meal-plans")
async def create_meal_plan(payload: MealPlanCreate, user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    try:
        ws = week_start_of(payload.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format tanggal salah (YYYY-MM-DD)")
    doc = {
        "id": f"mp_{uuid.uuid4().hex[:12]}",
        "household_id": hh["id"],
        "date": payload.date,
        "meal_type": payload.meal_type,
        "menu_name": payload.menu_name.strip(),
        "ingredients": [i.strip() for i in payload.ingredients if i.strip()],
        "is_archived": False,
        "week_start": ws,
        "created_at": now_utc(),
    }
    await db.meal_plans.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/meal-plans/{plan_id}")
async def update_meal_plan(plan_id: str, payload: MealPlanUpdate, user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    update = {}
    if payload.menu_name is not None:
        update["menu_name"] = payload.menu_name.strip()
    if payload.ingredients is not None:
        update["ingredients"] = [i.strip() for i in payload.ingredients if i.strip()]
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    res = await db.meal_plans.update_one(
        {"id": plan_id, "household_id": hh["id"]},
        {"$set": update},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan")
    doc = await db.meal_plans.find_one({"id": plan_id}, {"_id": 0})
    return doc


@api_router.delete("/meal-plans/{plan_id}")
async def delete_meal_plan(plan_id: str, user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    res = await db.meal_plans.delete_one({"id": plan_id, "household_id": hh["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu tidak ditemukan")
    return {"ok": True}


# ---------- Grocery List ----------
@api_router.get("/grocery")
async def list_grocery(user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    cur = db.grocery_lists.find(
        {"household_id": hh["id"], "is_archived": False},
        {"_id": 0},
    ).sort("created_at", 1)
    return await cur.to_list(500)


@api_router.post("/grocery")
async def add_grocery(payload: GroceryItemCreate, user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    name = payload.item_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama item tidak boleh kosong")
    cat = payload.category if payload.category and payload.category != "Lain-lain" else classify_ingredient(name)
    doc = {
        "id": f"gr_{uuid.uuid4().hex[:12]}",
        "household_id": hh["id"],
        "item_name": name,
        "category": cat,
        "is_bought": False,
        "is_archived": False,
        "created_at": now_utc(),
    }
    await db.grocery_lists.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/grocery/{item_id}/toggle")
async def toggle_grocery(item_id: str, payload: GroceryToggle, user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    res = await db.grocery_lists.update_one(
        {"id": item_id, "household_id": hh["id"]},
        {"$set": {"is_bought": payload.is_bought}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    doc = await db.grocery_lists.find_one({"id": item_id}, {"_id": 0})
    return doc


@api_router.delete("/grocery/{item_id}")
async def delete_grocery(item_id: str, user: dict = Depends(get_current_user)):
    hh = await get_household(user)
    res = await db.grocery_lists.delete_one({"id": item_id, "household_id": hh["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item tidak ditemukan")
    return {"ok": True}


@api_router.post("/grocery/generate")
async def generate_grocery(user: dict = Depends(get_current_user)):
    """Generate grocery list from active meal plans, minus fridge inventory."""
    hh = await get_household(user)
    # Collect all ingredients from active meal plans
    plans_cur = db.meal_plans.find(
        {"household_id": hh["id"], "is_archived": False},
        {"_id": 0, "ingredients": 1},
    )
    plans = await plans_cur.to_list(1000)
    needed = set()
    for p in plans:
        for ing in p.get("ingredients", []):
            n = ing.strip()
            if n:
                needed.add(n)

    # Get fridge inventory (normalized to lowercase for comparison)
    fridge_cur = db.fridge_inventories.find({"household_id": hh["id"]}, {"_id": 0, "item_name": 1})
    fridge_items = await fridge_cur.to_list(1000)
    fridge_lower = {f["item_name"].lower().strip() for f in fridge_items}

    # Existing active grocery items — avoid duplicates
    exist_cur = db.grocery_lists.find(
        {"household_id": hh["id"], "is_archived": False},
        {"_id": 0, "item_name": 1},
    )
    existing = await exist_cur.to_list(1000)
    existing_lower = {e["item_name"].lower().strip() for e in existing}

    added = []
    skipped_in_fridge = []
    for name in needed:
        low = name.lower()
        if low in fridge_lower:
            skipped_in_fridge.append(name)
            continue
        if low in existing_lower:
            continue
        cat = classify_ingredient(name)
        doc = {
            "id": f"gr_{uuid.uuid4().hex[:12]}",
            "household_id": hh["id"],
            "item_name": name,
            "category": cat,
            "is_bought": False,
            "is_archived": False,
            "created_at": now_utc(),
        }
        await db.grocery_lists.insert_one(doc)
        added.append(name)

    return {
        "added_count": len(added),
        "skipped_in_fridge_count": len(skipped_in_fridge),
        "added": added,
        "skipped_in_fridge": skipped_in_fridge,
    }


@api_router.post("/grocery/archive")
async def archive_week(user: dict = Depends(get_current_user)):
    """Archive all active meal plans and grocery items — 'Selesai Belanja Minggu Ini'."""
    hh = await get_household(user)
    await db.meal_plans.update_many(
        {"household_id": hh["id"], "is_archived": False},
        {"$set": {"is_archived": True}},
    )
    await db.grocery_lists.update_many(
        {"household_id": hh["id"], "is_archived": False},
        {"$set": {"is_archived": True}},
    )
    return {"ok": True}


# ---------- History ----------
@api_router.get("/history/weeks")
async def history_weeks(user: dict = Depends(get_current_user)):
    """Return archived weeks grouped by week_start."""
    hh = await get_household(user)
    cur = db.meal_plans.find(
        {"household_id": hh["id"], "is_archived": True},
        {"_id": 0},
    ).sort("date", -1)
    plans = await cur.to_list(2000)
    by_week: dict = {}
    for p in plans:
        ws = p["week_start"]
        by_week.setdefault(ws, []).append(p)
    weeks = []
    for ws, menus in sorted(by_week.items(), reverse=True):
        weeks.append({
            "week_start": ws,
            "menu_count": len(menus),
            "menus": menus,
        })
    return weeks


@api_router.post("/history/reuse/{week_start}")
async def reuse_week(week_start: str, user: dict = Depends(get_current_user)):
    """Copy an archived week's menus into the current active week."""
    hh = await get_household(user)
    today = now_utc().strftime("%Y-%m-%d")
    current_ws = week_start_of(today)
    current_ws_dt = datetime.strptime(current_ws, "%Y-%m-%d")
    src_ws_dt = datetime.strptime(week_start, "%Y-%m-%d")
    offset_days = (current_ws_dt - src_ws_dt).days

    cur = db.meal_plans.find(
        {"household_id": hh["id"], "is_archived": True, "week_start": week_start},
        {"_id": 0},
    )
    plans = await cur.to_list(200)
    copied = 0
    for p in plans:
        old_date = datetime.strptime(p["date"], "%Y-%m-%d")
        new_date = (old_date + timedelta(days=offset_days)).strftime("%Y-%m-%d")
        doc = {
            "id": f"mp_{uuid.uuid4().hex[:12]}",
            "household_id": hh["id"],
            "date": new_date,
            "meal_type": p["meal_type"],
            "menu_name": p["menu_name"],
            "ingredients": p.get("ingredients", []),
            "is_archived": False,
            "week_start": current_ws,
            "created_at": now_utc(),
        }
        await db.meal_plans.insert_one(doc)
        copied += 1
    return {"copied": copied, "week_start": current_ws}


# ---------- Root ----------
@api_router.get("/")
async def root():
    return {"message": "Smart Grocery & Meal Planner API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
