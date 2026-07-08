# DapurKita — Smart Grocery & Meal Planner

## Overview
Mobile-first Expo app for Indonesian couples to collaboratively plan weekly meals,
track fridge inventory, and auto-generate a real-time grocery list.

## Stack
- Frontend: Expo Router + React Native (SDK 54)
- Backend: FastAPI + Motor (async MongoDB driver)
- Auth: Emergent Google OAuth (session_token, 7d)

## Key Features
1. **Household-based collaboration**: users create or join a household via a 6-char invite code.
2. **Fridge inventory (Stok Kulkas)**: simple name-only items, thumb-friendly quick-add + suggestions.
3. **Weekly Meal Planner (Senin–Minggu)** with Sarapan/Makan Siang/Makan Malam.
   - Smart recipe suggestion: when user types a menu name, the app queries `master_recipes` (20 Indonesian recipes seeded) and offers ingredient chips.
   - User can toggle suggested ingredients + add custom ingredients.
4. **Auto-generate grocery list** cross-checks each ingredient against fridge inventory — items already in the fridge are skipped.
5. **Categorized checklist**: grouped into Sayuran, Bumbu Dapur, Daging/Protein, Kebutuhan Rumah, Lain-lain, with big touch-friendly checkboxes. Real-time sync via 3s polling.
6. **Archive & History**: "Selesai Belanja Minggu Ini" archives the week. History tab lists prior weeks; "Gunakan Menu Ini Lagi" copies the archived week into the current active week.

## API Endpoints (all under `/api`)
- Auth: `POST /auth/session`, `GET /auth/me`, `POST /auth/logout`
- Household: `POST /household/create`, `POST /household/join`, `GET /household/me`, `POST /household/leave`
- Recipes: `GET /recipes/search?q=`
- Fridge: `GET /fridge`, `POST /fridge`, `DELETE /fridge/{id}`
- Meal Plans: `GET /meal-plans?week_start=`, `POST /meal-plans`, `PUT /meal-plans/{id}`, `DELETE /meal-plans/{id}`
- Grocery: `GET /grocery`, `POST /grocery`, `PUT /grocery/{id}/toggle`, `DELETE /grocery/{id}`, `POST /grocery/generate`, `POST /grocery/archive`
- History: `GET /history/weeks`, `POST /history/reuse/{week_start}`

## MongoDB collections
`users`, `user_sessions`, `households`, `master_recipes`, `meal_plans`, `fridge_inventories`, `grocery_lists`.
All queries exclude `_id` via projection.
