"""Full backend integration tests for DapurKita."""
import uuid
from datetime import datetime, timezone

import requests

from conftest import auth_headers


# ---------- AUTH ----------
class TestAuth:
    def test_me_requires_bearer_token(self, base_url, api):
        r = api.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_seeded_session(self, base_url, api, seeded_user):
        r = api.get(f"{base_url}/api/auth/me", headers=auth_headers(seeded_user["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == seeded_user["user_id"]
        assert data["email"] == seeded_user["email"]
        assert data["household_id"] is None

    def test_me_invalid_token(self, base_url, api):
        r = api.get(f"{base_url}/api/auth/me", headers=auth_headers("garbage-token"))
        assert r.status_code == 401


# ---------- HOUSEHOLD ----------
class TestHousehold:
    def test_create_household_and_link(self, base_url, api, seeded_user):
        r = api.post(f"{base_url}/api/household/create",
                     headers=auth_headers(seeded_user["token"]),
                     json={"name": "TEST Keluarga Uji"})
        assert r.status_code == 200, r.text
        hh = r.json()
        assert "id" in hh and "invite_code" in hh
        assert hh["name"] == "TEST Keluarga Uji"
        assert len(hh["invite_code"]) == 6

        # user is linked to it
        me = api.get(f"{base_url}/api/auth/me", headers=auth_headers(seeded_user["token"])).json()
        assert me["household_id"] == hh["id"]

        # second create attempt fails
        r2 = api.post(f"{base_url}/api/household/create",
                      headers=auth_headers(seeded_user["token"]),
                      json={"name": "Another"})
        assert r2.status_code == 400

    def test_join_household_valid_and_invalid(self, base_url, api, seeded_user, seeded_user_b):
        # A creates household
        r = api.post(f"{base_url}/api/household/create",
                     headers=auth_headers(seeded_user["token"]),
                     json={"name": "TEST HH"})
        assert r.status_code == 200
        code = r.json()["invite_code"]

        # B joins with valid code
        rj = api.post(f"{base_url}/api/household/join",
                      headers=auth_headers(seeded_user_b["token"]),
                      json={"invite_code": code})
        assert rj.status_code == 200, rj.text
        assert rj.json()["invite_code"] == code

        # B tries invalid code (new session needed - but B is already in a hh -> 400)
        # Instead: verify invalid code path with a NEW user simulated via cleanup:
        # simpler: check /household/me
        me_b = api.get(f"{base_url}/api/auth/me", headers=auth_headers(seeded_user_b["token"])).json()
        assert me_b["household_id"] == r.json()["id"]

    def test_join_invalid_code(self, base_url, api, seeded_user):
        r = api.post(f"{base_url}/api/household/join",
                     headers=auth_headers(seeded_user["token"]),
                     json={"invite_code": "ZZZZZZ"})
        assert r.status_code == 404

    def test_household_me_lists_members(self, base_url, api, seeded_user, seeded_user_b):
        r = api.post(f"{base_url}/api/household/create",
                     headers=auth_headers(seeded_user["token"]),
                     json={"name": "TEST Members"})
        code = r.json()["invite_code"]
        api.post(f"{base_url}/api/household/join",
                 headers=auth_headers(seeded_user_b["token"]),
                 json={"invite_code": code})

        me_hh = api.get(f"{base_url}/api/household/me",
                        headers=auth_headers(seeded_user["token"]))
        assert me_hh.status_code == 200
        payload = me_hh.json()
        assert payload["invite_code"] == code
        emails = {m["email"] for m in payload["members"]}
        assert seeded_user["email"] in emails
        assert seeded_user_b["email"] in emails


# ---------- RECIPES ----------
class TestRecipes:
    def test_search_returns_sayur_asem(self, base_url, api, seeded_user):
        r = api.get(f"{base_url}/api/recipes/search",
                    params={"q": "sayur"},
                    headers=auth_headers(seeded_user["token"]))
        assert r.status_code == 200
        names = [x["menu_name"] for x in r.json()]
        assert "Sayur Asem" in names
        sayur = next(x for x in r.json() if x["menu_name"] == "Sayur Asem")
        assert isinstance(sayur["suggested_ingredients"], list)
        assert len(sayur["suggested_ingredients"]) > 0

    def test_search_empty_returns_list(self, base_url, api, seeded_user):
        r = api.get(f"{base_url}/api/recipes/search",
                    headers=auth_headers(seeded_user["token"]))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert 1 <= len(data) <= 20


# ---------- FRIDGE ----------
class TestFridge:
    def _mkhh(self, base_url, api, user):
        r = api.post(f"{base_url}/api/household/create",
                     headers=auth_headers(user["token"]),
                     json={"name": "TEST Fridge HH"})
        assert r.status_code == 200

    def test_fridge_crud_and_isolation(self, base_url, api, seeded_user, seeded_user_b):
        self._mkhh(base_url, api, seeded_user)
        self._mkhh(base_url, api, seeded_user_b)

        # A adds fridge item
        r = api.post(f"{base_url}/api/fridge",
                     headers=auth_headers(seeded_user["token"]),
                     json={"item_name": "Bawang Merah"})
        assert r.status_code == 200
        item = r.json()
        assert item["item_name"] == "Bawang Merah"
        assert "id" in item

        # A lists
        r = api.get(f"{base_url}/api/fridge",
                    headers=auth_headers(seeded_user["token"]))
        assert r.status_code == 200
        items = r.json()
        assert any(i["id"] == item["id"] for i in items)

        # B (different household) does not see it
        rb = api.get(f"{base_url}/api/fridge",
                     headers=auth_headers(seeded_user_b["token"]))
        assert rb.status_code == 200
        assert all(i["id"] != item["id"] for i in rb.json())

        # A deletes
        rd = api.delete(f"{base_url}/api/fridge/{item['id']}",
                        headers=auth_headers(seeded_user["token"]))
        assert rd.status_code == 200
        # Verify gone
        r = api.get(f"{base_url}/api/fridge",
                    headers=auth_headers(seeded_user["token"]))
        assert all(i["id"] != item["id"] for i in r.json())


# ---------- MEAL PLANS ----------
class TestMealPlans:
    def _mkhh(self, base_url, api, user):
        r = api.post(f"{base_url}/api/household/create",
                     headers=auth_headers(user["token"]),
                     json={"name": "TEST MP HH"})
        assert r.status_code == 200

    def test_meal_plan_crud(self, base_url, api, seeded_user):
        self._mkhh(base_url, api, seeded_user)
        h = auth_headers(seeded_user["token"])

        # Create — 2026-02-09 is a Monday
        payload = {
            "date": "2026-02-09",
            "meal_type": "Makan Siang",
            "menu_name": "Sayur Asem",
            "ingredients": ["Kacang Panjang", "Jagung"],
        }
        r = api.post(f"{base_url}/api/meal-plans", headers=h, json=payload)
        assert r.status_code == 200, r.text
        mp = r.json()
        assert mp["week_start"] == "2026-02-09"
        assert mp["menu_name"] == "Sayur Asem"
        assert mp["ingredients"] == ["Kacang Panjang", "Jagung"]
        mp_id = mp["id"]

        # List
        r = api.get(f"{base_url}/api/meal-plans", params={"week_start": "2026-02-09"}, headers=h)
        assert r.status_code == 200
        assert any(x["id"] == mp_id for x in r.json())

        # PUT ingredients
        r = api.put(f"{base_url}/api/meal-plans/{mp_id}",
                    headers=h,
                    json={"ingredients": ["Kacang Panjang", "Jagung", "Labu Siam"]})
        assert r.status_code == 200
        assert r.json()["ingredients"] == ["Kacang Panjang", "Jagung", "Labu Siam"]

        # Verify persisted
        r = api.get(f"{base_url}/api/meal-plans", params={"week_start": "2026-02-09"}, headers=h)
        found = [x for x in r.json() if x["id"] == mp_id][0]
        assert "Labu Siam" in found["ingredients"]

        # DELETE
        rd = api.delete(f"{base_url}/api/meal-plans/{mp_id}", headers=h)
        assert rd.status_code == 200
        r = api.get(f"{base_url}/api/meal-plans", params={"week_start": "2026-02-09"}, headers=h)
        assert all(x["id"] != mp_id for x in r.json())

    def test_week_start_calc_non_monday(self, base_url, api, seeded_user):
        self._mkhh(base_url, api, seeded_user)
        h = auth_headers(seeded_user["token"])
        # 2026-02-12 (Thursday) -> Monday 2026-02-09
        r = api.post(f"{base_url}/api/meal-plans", headers=h, json={
            "date": "2026-02-12", "meal_type": "Sarapan",
            "menu_name": "Nasi Goreng", "ingredients": []
        })
        assert r.status_code == 200
        assert r.json()["week_start"] == "2026-02-09"


# ---------- GROCERY ----------
class TestGrocery:
    def _mkhh(self, base_url, api, user):
        assert api.post(f"{base_url}/api/household/create",
                        headers=auth_headers(user["token"]),
                        json={"name": "TEST GR HH"}).status_code == 200

    def test_add_toggle_delete_auto_categorize(self, base_url, api, seeded_user):
        self._mkhh(base_url, api, seeded_user)
        h = auth_headers(seeded_user["token"])

        # Manual category
        r = api.post(f"{base_url}/api/grocery", headers=h,
                     json={"item_name": "Sabun Cuci", "category": "Kebutuhan Rumah"})
        assert r.status_code == 200
        assert r.json()["category"] == "Kebutuhan Rumah"

        # Auto classify when Lain-lain
        r = api.post(f"{base_url}/api/grocery", headers=h,
                     json={"item_name": "Bayam", "category": "Lain-lain"})
        assert r.status_code == 200
        item = r.json()
        assert item["category"] == "Sayuran"
        item_id = item["id"]
        assert item["is_bought"] is False

        # Toggle
        r = api.put(f"{base_url}/api/grocery/{item_id}/toggle", headers=h,
                    json={"is_bought": True})
        assert r.status_code == 200
        assert r.json()["is_bought"] is True

        # Verify persisted via GET
        r = api.get(f"{base_url}/api/grocery", headers=h)
        got = [x for x in r.json() if x["id"] == item_id][0]
        assert got["is_bought"] is True

        # Delete
        rd = api.delete(f"{base_url}/api/grocery/{item_id}", headers=h)
        assert rd.status_code == 200
        r = api.get(f"{base_url}/api/grocery", headers=h)
        assert all(x["id"] != item_id for x in r.json())

    def test_generate_respects_fridge_and_dedupes(self, base_url, api, seeded_user):
        self._mkhh(base_url, api, seeded_user)
        h = auth_headers(seeded_user["token"])

        # Seed 2 meal plans with overlapping ingredients
        api.post(f"{base_url}/api/meal-plans", headers=h, json={
            "date": "2026-02-09", "meal_type": "Makan Siang", "menu_name": "Sayur Asem",
            "ingredients": ["Kacang Panjang", "Jagung", "Bawang Merah"]
        })
        api.post(f"{base_url}/api/meal-plans", headers=h, json={
            "date": "2026-02-10", "meal_type": "Makan Malam", "menu_name": "Nasi Goreng",
            "ingredients": ["Bawang Merah", "Bawang Putih", "Telur"]
        })
        # Fridge has Bawang Merah (case-insensitive check via lowercase)
        api.post(f"{base_url}/api/fridge", headers=h, json={"item_name": "bawang merah"})

        # First generate
        r = api.post(f"{base_url}/api/grocery/generate", headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["skipped_in_fridge_count"] >= 1
        assert any(s.lower() == "bawang merah" for s in data["skipped_in_fridge"])
        assert all(s.lower() != "bawang merah" for s in data["added"])
        # Should have added the other ingredients
        added_lower = {a.lower() for a in data["added"]}
        for expected in ["kacang panjang", "jagung", "bawang putih", "telur"]:
            assert expected in added_lower, f"Missing {expected}"
        first_added = data["added_count"]
        assert first_added >= 4

        # Second call — no duplicates
        r2 = api.post(f"{base_url}/api/grocery/generate", headers=h)
        assert r2.status_code == 200
        assert r2.json()["added_count"] == 0

        # Verify grocery list count
        gl = api.get(f"{base_url}/api/grocery", headers=h).json()
        # Count only items whose name matches the added set (case-insensitive)
        matching = [x for x in gl if x["item_name"].lower() in added_lower]
        assert len(matching) == first_added

    def test_realtime_sync_between_household_members(self, base_url, api, seeded_user, seeded_user_b):
        # A creates household, B joins
        r = api.post(f"{base_url}/api/household/create",
                     headers=auth_headers(seeded_user["token"]),
                     json={"name": "TEST SYNC"})
        code = r.json()["invite_code"]
        api.post(f"{base_url}/api/household/join",
                 headers=auth_headers(seeded_user_b["token"]),
                 json={"invite_code": code})

        # A adds grocery item
        r = api.post(f"{base_url}/api/grocery",
                     headers=auth_headers(seeded_user["token"]),
                     json={"item_name": "Tempe"})
        assert r.status_code == 200
        item = r.json()

        # B sees it
        rb = api.get(f"{base_url}/api/grocery", headers=auth_headers(seeded_user_b["token"]))
        assert any(x["id"] == item["id"] for x in rb.json())

        # B toggles bought
        rt = api.put(f"{base_url}/api/grocery/{item['id']}/toggle",
                     headers=auth_headers(seeded_user_b["token"]),
                     json={"is_bought": True})
        assert rt.status_code == 200

        # A sees is_bought=true
        ra = api.get(f"{base_url}/api/grocery", headers=auth_headers(seeded_user["token"]))
        got = [x for x in ra.json() if x["id"] == item["id"]][0]
        assert got["is_bought"] is True

    def test_isolation_across_households(self, base_url, api, seeded_user, seeded_user_b):
        # Two separate households
        api.post(f"{base_url}/api/household/create",
                 headers=auth_headers(seeded_user["token"]), json={"name": "HH A"})
        api.post(f"{base_url}/api/household/create",
                 headers=auth_headers(seeded_user_b["token"]), json={"name": "HH B"})

        r = api.post(f"{base_url}/api/grocery",
                     headers=auth_headers(seeded_user["token"]),
                     json={"item_name": "Ayam"})
        item = r.json()

        rb = api.get(f"{base_url}/api/grocery",
                     headers=auth_headers(seeded_user_b["token"]))
        assert all(x["id"] != item["id"] for x in rb.json())


# ---------- ARCHIVE & HISTORY ----------
class TestArchiveHistory:
    def _mkhh(self, base_url, api, user):
        assert api.post(f"{base_url}/api/household/create",
                        headers=auth_headers(user["token"]),
                        json={"name": "TEST AH HH"}).status_code == 200

    def test_archive_clears_active_lists(self, base_url, api, seeded_user):
        self._mkhh(base_url, api, seeded_user)
        h = auth_headers(seeded_user["token"])

        api.post(f"{base_url}/api/meal-plans", headers=h, json={
            "date": "2026-02-09", "meal_type": "Sarapan", "menu_name": "Nasi Goreng",
            "ingredients": ["Bawang Merah", "Telur"]
        })
        api.post(f"{base_url}/api/grocery/generate", headers=h)

        # Should be non-empty pre-archive
        assert len(api.get(f"{base_url}/api/meal-plans", headers=h).json()) > 0
        assert len(api.get(f"{base_url}/api/grocery", headers=h).json()) > 0

        ra = api.post(f"{base_url}/api/grocery/archive", headers=h)
        assert ra.status_code == 200

        assert api.get(f"{base_url}/api/meal-plans", headers=h).json() == []
        assert api.get(f"{base_url}/api/grocery", headers=h).json() == []

    def test_history_weeks_and_reuse(self, base_url, api, seeded_user):
        self._mkhh(base_url, api, seeded_user)
        h = auth_headers(seeded_user["token"])

        # Old week: Monday 2026-01-05, plus Tuesday 2026-01-06 (offset day 1)
        api.post(f"{base_url}/api/meal-plans", headers=h, json={
            "date": "2026-01-05", "meal_type": "Sarapan", "menu_name": "Nasi Goreng",
            "ingredients": ["Telur"]
        })
        api.post(f"{base_url}/api/meal-plans", headers=h, json={
            "date": "2026-01-06", "meal_type": "Makan Malam", "menu_name": "Sayur Asem",
            "ingredients": ["Kacang Panjang"]
        })
        # Archive so it moves into history
        api.post(f"{base_url}/api/grocery/archive", headers=h)

        # History has that week
        weeks = api.get(f"{base_url}/api/history/weeks", headers=h).json()
        assert any(w["week_start"] == "2026-01-05" for w in weeks)
        target = next(w for w in weeks if w["week_start"] == "2026-01-05")
        assert target["menu_count"] == 2

        # Reuse into current week
        rr = api.post(f"{base_url}/api/history/reuse/2026-01-05", headers=h)
        assert rr.status_code == 200, rr.text
        current_ws = rr.json()["week_start"]
        assert rr.json()["copied"] == 2

        # Verify current active week has 2 menus, dates offset by same day-of-week
        current = api.get(f"{base_url}/api/meal-plans", params={"week_start": current_ws}, headers=h).json()
        assert len(current) == 2
        menu_names = {m["menu_name"] for m in current}
        assert menu_names == {"Nasi Goreng", "Sayur Asem"}
        # Verify all week_start on new copies equals current_ws
        assert all(m["week_start"] == current_ws for m in current)
        # Verify offset: nasi goreng (Monday src) -> Monday of current; sayur asem (Tuesday src) -> Tuesday
        from datetime import datetime as _dt
        for m in current:
            d = _dt.strptime(m["date"], "%Y-%m-%d")
            ws = _dt.strptime(current_ws, "%Y-%m-%d")
            if m["menu_name"] == "Nasi Goreng":
                assert (d - ws).days == 0
            else:
                assert (d - ws).days == 1
