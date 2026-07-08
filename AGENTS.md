# Agent Notes

This repository is a compact Expo + FastAPI app. Prefer reading these files
first when starting work:

1. `README.md` for project map, commands, and runtime expectations.
2. `memory/PRD.md` for the original product requirements.
3. `backend/server.py` for all backend behavior.
4. `frontend/src/api/client.ts` and `frontend/src/context/AuthContext.tsx` for
   API/auth flow.
5. `frontend/app/_layout.tsx` for auth gate redirects.
6. `frontend/app/(tabs)/*.tsx` for the main app screens.

## Local Constraints

- The backend needs `MONGO_URL` and `DB_NAME`.
- The frontend needs `EXPO_PUBLIC_BACKEND_URL`.
- Backend tests need a running API and MongoDB; they do not mock the server.
- Git may complain about dubious ownership in this checkout. Use:

```powershell
git -c safe.directory=C:/work/freelance/KulkasKita status --short
```

## Coding Conventions

- Frontend uses Expo Router route files and `@/*` imports.
- UI tokens are centralized in `frontend/src/theme.ts`.
- API calls go through `frontend/src/api/client.ts`; auth token is set by
  `AuthContext`.
- Backend routes all live under `/api` through `api_router`.
- Mongo queries should keep excluding `_id` in API responses.
- Household isolation is important. Most domain queries must include
  `household_id`.

## Risk Areas

- Auth depends on Emergent's external OAuth session-data endpoint.
- `archive_week` archives all active plans/items for the household, regardless
  of `week_start`.
- `reuse_week` copies archived menus into the current week based on backend
  current date.
- Several frontend strings appear mojibake-encoded from previous generation;
  be careful when editing copy.
- `backend/=0.24.0` looks like accidental command output.
