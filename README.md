# KulkasKita / DapurKita

Mobile-first meal planner and grocery collaboration app for Indonesian couples.
Users can create or join a household, track fridge inventory, plan weekly meals,
generate grocery lists from planned ingredients, and archive/reuse past weeks.

## Stack

- Frontend: Expo Router, React Native, TypeScript, Expo SDK 54
- Backend: FastAPI, Motor async MongoDB driver, Pydantic
- Database: MongoDB
- Auth: Emergent Google OAuth session exchange
- Tests: Pytest integration tests for backend API

## Repository Map

```text
backend/
  server.py                  FastAPI app, models, routes, recipe seed data
  requirements.txt           Python dependencies
  tests/                     Backend integration tests

frontend/
  app/                       Expo Router screens and tab routes
  src/api/client.ts          Fetch wrapper and auth header handling
  src/context/AuthContext.tsx Auth/session state
  src/components/            Shared UI components
  src/theme.ts               Color, spacing, radius, shadow tokens
  package.json               Expo scripts and dependencies

memory/PRD.md                Original product brief
test_reports/                Prior generated test output
test_result.md               Prior test summary
design_guidelines.json       Design guidance artifact
```

## Main Product Flow

1. Login exchanges an Emergent `session_id` for a persisted app session token.
2. User creates or joins a household with a 6-character invite code.
3. Household members add fridge items.
4. Members create meal plans for the current week.
5. Grocery generation combines meal ingredients, skips items already in the fridge,
   categorizes new items, and avoids duplicates.
6. Grocery completion archives active meal plans and grocery items.
7. History can reuse an archived week into the current active week.

## Backend

The API lives in `backend/server.py` and mounts every route under `/api`.

Required environment:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=kulkaskita
```

Run locally:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Important route groups:

- Auth: `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`
- Household: `/api/household/create`, `/api/household/join`, `/api/household/me`, `/api/household/leave`
- Recipes: `/api/recipes/search`
- Fridge: `/api/fridge`
- Meal plans: `/api/meal-plans`
- Grocery: `/api/grocery`, `/api/grocery/generate`, `/api/grocery/archive`
- History: `/api/history/weeks`, `/api/history/reuse/{week_start}`

## Frontend

Required environment:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

Run locally:

```powershell
cd frontend
yarn install
yarn start
```

Useful scripts:

- `yarn start` starts Expo.
- `yarn web` starts Expo web.
- `yarn android` / `yarn ios` starts the platform launcher.
- `yarn lint` runs Expo lint.

## Tests

Backend tests are integration tests that call a running API and seed MongoDB
directly for auth sessions. Start the backend first, then run:

```powershell
cd backend
$env:EXPO_PUBLIC_BACKEND_URL="http://localhost:8000"
$env:MONGO_URL="mongodb://localhost:27017"
$env:DB_NAME="test_database"
pytest
```

## Notes For Maintainers

- `backend/server.py` is currently a single-file backend. Read the utility,
  model, auth helper, seed, and route sections in order.
- Recipe seed data is created at FastAPI startup if `master_recipes` has fewer
  records than the seed list.
- Frontend polling is used for near-real-time sync: fridge every 4 seconds,
  meal planner every 5 seconds, grocery every 3 seconds.
- `backend/=0.24.0` appears to be a stray installation log/output file, not
  application code. Confirm before deleting it.
- The repo may trigger Git "dubious ownership" warnings on this machine. Use
  `git -c safe.directory=C:/work/freelance/KulkasKita ...` or add the path to
  Git safe directories if you own this checkout.
