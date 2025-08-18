import asyncio
import csv
import sys
from pathlib import Path
from typing import List, Tuple

from playwright.async_api import async_playwright, Page, Locator


PROFILE_URL = "https://bestiaryarena.com/profile/bakurraa"
OUTPUT_CSV = Path("/workspace/bestiary_bakurraa.csv")
DEBUG_HTML = Path("/workspace/bestiary_section.html")
DEBUG_PNG = Path("/workspace/bestiary_section.png")
NEXT_DATA_JSON = Path("/workspace/next_data.json")
BESTIARY_NEXT_DATA_JSON = Path("/workspace/bestiary_next_data.json")


async def locate_bestiary_container(page: Page):
    # Look for a heading "Bestiary" and take a nearby container
    heading = page.get_by_role("heading", name="Bestiary", exact=False).first
    if await heading.count() > 0:
        container = heading
        for _ in range(6):
            container = container.locator("xpath=..")
            if await container.locator("css=.card, .grid, .cards, .list, [class*='bestiary' i], .box, .container").count() > 0:
                return container
    # Fallback: any element with class name containing bestiary
    candidate = page.locator("css=[class*='bestiary' i]").first
    if await candidate.count() > 0:
        return candidate
    # Last resort: whole page
    return page.locator("body")


async def dump_debug(container) -> None:
    try:
        html = await container.evaluate("el => el.outerHTML")
        DEBUG_HTML.write_text(html)
    except Exception:
        pass
    try:
        await container.screenshot(path=str(DEBUG_PNG))
    except Exception:
        pass


async def extract_name_tier_pairs(container: Locator, page: Page) -> List[Tuple[str, str]]:
    # Find all bestiary item buttons that contain a portrait image
    item_buttons = container.locator("button:has(img[src*='/assets/portraits/'])")
    count = await item_buttons.count()
    pairs: List[Tuple[str, str]] = []
    seen = set()

    for i in range(count):
        btn = item_buttons.nth(i)
        # Determine tier from star-tier image filename if present
        tier_src = None
        try:
            tier_img = btn.locator("img.tier-stars").first
            if await tier_img.count() > 0:
                tier_src = await tier_img.get_attribute("src")
        except Exception:
            tier_src = None
        tier = ""
        if tier_src:
            # Expect like /assets/icons/star-tier-4.png
            try:
                tier_num = tier_src.split("star-tier-")[-1].split(".")[0]
                tier = tier_num.strip()
            except Exception:
                tier = ""

        # Try hover first to trigger tooltip with name
        await btn.scroll_into_view_if_needed()
        await btn.hover()
        panel = page.locator("[role='tooltip'], [data-state='open']").last
        try:
            await panel.wait_for(timeout=2000)
        except Exception:
            # try dialog role as fallback (if hovering didn't work, click)
            await btn.click()
            panel = page.get_by_role("dialog").first
            try:
                await panel.wait_for(timeout=1500)
            except Exception:
                panel = page.get_by_role("tooltip").first
                try:
                    await panel.wait_for(timeout=1000)
                except Exception:
                    panel = None

        name = ""
        if panel is not None:
            try:
                # Try common selectors for a name
                name_loc = panel.locator("[class*='name' i], h1, h2, h3, .pixel-font-16, .pixel-font-14").first
                if await name_loc.count() > 0:
                    candidate = (await name_loc.inner_text()).strip()
                    # Sanity filter: ignore obvious numeric-only strings
                    if candidate and not candidate.isdigit():
                        name = candidate.split("\n")[0].strip()
            except Exception:
                pass
        
        # Debug: dump HTML/screenshot for first few interactions
        try:
            if i < 3:
                (Path("/workspace")/f"debug_click_{i}.html").write_text(await page.content())
                await page.screenshot(path=f"/workspace/debug_click_{i}.png", full_page=True)
        except Exception:
            pass

        if not name:
            # Fallback: try aria-labelledby if the button controls a popup
            try:
                labelled_by = await btn.get_attribute("aria-labelledby")
                if labelled_by:
                    ref = page.locator(f"#{labelled_by.strip()}")
                    if await ref.count() > 0:
                        txt = (await ref.first.inner_text()).strip()
                        if txt and not txt.isdigit():
                            name = txt
            except Exception:
                pass

        # As a last resort, try to infer name from image alt on opened panel
        if not name and panel is not None:
            try:
                alt_img = panel.locator("img[alt]:not([alt='creature'])").first
                if await alt_img.count() > 0:
                    alt_text = await alt_img.get_attribute("alt")
                    if alt_text and alt_text.lower() != "creature":
                        name = alt_text.strip()
            except Exception:
                pass

        if name:
            key = (name, tier or "")
            if key not in seen:
                seen.add(key)
                pairs.append((name, tier or ""))

        # Dismiss panel by pressing Escape
        try:
            await page.keyboard.press("Escape")
        except Exception:
            pass

    return pairs


async def discover_portrait_name_map(page: Page) -> dict:
    portrait_to_name: dict[int, str] = {}
    candidate_paths = [
        "/bestiary",
        "/monsters",
        "/creatures",
        "/units",
    ]
    for path in candidate_paths:
        try:
            resp = await page.goto(f"https://bestiaryarena.com{path}", wait_until="domcontentloaded")
            if not resp or not resp.ok:
                continue
            # Look for any grid of portraits
            portraits = page.locator("img[src*='/assets/portraits/']")
            count = await portraits.count()
            if count == 0:
                continue
            # Try to extract from nearby text or by clicking into each card for a name
            for i in range(min(count, 500)):
                img = portraits.nth(i)
                src = await img.get_attribute("src")
                if not src:
                    continue
                try:
                    pid = int(src.rsplit("/", 1)[-1].split(".")[0])
                except Exception:
                    continue
                name = ""
                # Try aria-label/title around the image
                parent = img.locator("xpath=ancestor-or-self::a|ancestor-or-self::button|ancestor-or-self::div[1]").first
                try:
                    if await parent.count() > 0:
                        label = await parent.get_attribute("aria-label")
                        if label and len(label.strip()) > 1:
                            name = label.strip()
                        if not name:
                            title = await parent.get_attribute("title")
                            if title and len(title.strip()) > 1:
                                name = title.strip()
                except Exception:
                    pass
                if not name:
                    # Try visible sibling text
                    try:
                        sib_text = await parent.inner_text()
                        cand = sib_text.strip().split("\n")[0]
                        if cand and not cand.isdigit() and len(cand) <= 40:
                            name = cand
                    except Exception:
                        pass
                if not name:
                    # Click to open details and read a prominent heading
                    try:
                        await parent.scroll_into_view_if_needed()
                        await parent.click()
                        panel = page.get_by_role("dialog").first
                        try:
                            await panel.wait_for(timeout=1500)
                            header = panel.locator("h1, h2, h3, [class*='name' i], .pixel-font-16, .pixel-font-14").first
                            if await header.count() > 0:
                                txt = (await header.inner_text()).strip().split("\n")[0]
                                if txt and not txt.isdigit():
                                    name = txt
                        except Exception:
                            pass
                        try:
                            await page.keyboard.press("Escape")
                        except Exception:
                            pass
                    except Exception:
                        pass
                if name:
                    portrait_to_name[pid] = name
            if portrait_to_name:
                return portrait_to_name
        except Exception:
            continue
    return portrait_to_name


async def main() -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto(PROFILE_URL, wait_until="networkidle")

        # Dump Next.js data for inspection
        try:
            next_data = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
            if next_data:
                NEXT_DATA_JSON.write_text(next_data)
        except Exception:
            pass

        # Navigate to general Bestiary page and dump global data
        try:
            await page.goto("https://bestiaryarena.com/bestiary", wait_until="networkidle")
            bestiary_data = await page.evaluate("() => JSON.stringify(window.__NEXT_DATA__)")
            if bestiary_data:
                BESTIARY_NEXT_DATA_JSON.write_text(bestiary_data)
        except Exception:
            pass

        # Ensure the main content is rendered and scroll to load any lazy content
        try:
            await page.get_by_text("Bestiary", exact=False).first.wait_for(timeout=5000)
        except Exception:
            pass
        try:
            for _ in range(8):
                await page.mouse.wheel(0, 1600)
                await page.wait_for_timeout(300)
        except Exception:
            pass

        # Try to build name list from Next.js data first (more reliable)
        names_only: List[str] = []
        try:
            import json
            profile_data = json.loads(NEXT_DATA_JSON.read_text())
            bestiary_data = json.loads(BESTIARY_NEXT_DATA_JSON.read_text()) if BESTIARY_NEXT_DATA_JSON.exists() else {}
            # Collect gameIds from profile monsters
            profile_game_ids = []
            try:
                profile_game_ids = [int(m.get("gameId")) for m in profile_data["props"]["pageProps"]["pageData"].get("monsters", []) if m.get("gameId") is not None]
            except Exception:
                profile_game_ids = []

            # Attempt to find a mapping of id->name in bestiary_data
            id_to_name: dict[int, str] = {}

            def traverse(obj):
                if isinstance(obj, dict):
                    # Common patterns: objects with keys 'id' and 'name' or 'gameId' and 'name'
                    if ("id" in obj or "gameId" in obj) and "name" in obj and isinstance(obj["name"], str):
                        try:
                            key = int(obj.get("gameId", obj.get("id")))
                            if key not in id_to_name and obj["name"].strip():
                                id_to_name[key] = obj["name"].strip()
                        except Exception:
                            pass
                    for v in obj.values():
                        traverse(v)
                elif isinstance(obj, list):
                    for v in obj:
                        traverse(v)

            traverse(bestiary_data)

            found_ids = set(id_to_name.keys())
            needed_ids = sorted(set(profile_game_ids))
            names_only = [id_to_name[g] for g in needed_ids if g in id_to_name]

            # If some names are missing, probe potential API endpoints
            missing_ids = [g for g in needed_ids if g not in found_ids]
            if missing_ids:
                endpoint_patterns = [
                    "https://bestiaryarena.com/api/monster/{id}",
                    "https://bestiaryarena.com/api/monsters/{id}",
                    "https://bestiaryarena.com/api/creature/{id}",
                    "https://bestiaryarena.com/api/creatures/{id}",
                    "https://bestiaryarena.com/api/wiki/monster/{id}",
                    "https://bestiaryarena.com/api/wiki/creature/{id}",
                ]
                for gid in missing_ids:
                    name_for_id = None
                    for pattern in endpoint_patterns:
                        url = pattern.format(id=gid)
                        try:
                            resp = await context.request.get(url)
                            if resp.ok:
                                try:
                                    data = await resp.json()
                                except Exception:
                                    try:
                                        txt = await resp.text()
                                        import json as _json
                                        data = _json.loads(txt)
                                    except Exception:
                                        data = None
                                if isinstance(data, dict):
                                    for key in ("name", "title", "monsterName", "displayName"):
                                        if isinstance(data.get(key), str) and data.get(key).strip():
                                            name_for_id = data[key].strip()
                                            break
                                    if not name_for_id:
                                        # Try nested structures
                                        for k, v in data.items():
                                            if isinstance(v, dict) and isinstance(v.get("name"), str):
                                                name_for_id = v["name"].strip()
                                                break
                                if name_for_id:
                                    id_to_name[gid] = name_for_id
                                    break
                        except Exception:
                            continue
                names_only = [id_to_name[g] for g in needed_ids if g in id_to_name]
        except Exception:
            names_only = []

        if names_only:
            with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["name"]) 
                for n in names_only:
                    writer.writerow([n])
        else:
            # Fallback to interactive extraction (may be partial)
            container = await locate_bestiary_container(page)
            await dump_debug(container)
            pairs = await extract_name_tier_pairs(container, page)
            # Keep only names
            names = sorted({n for (n, _t) in pairs})
            with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["name"]) 
                for n in names:
                    writer.writerow([n])

        await context.close()
        await browser.close()

    try:
        rows = sum(1 for _ in OUTPUT_CSV.open("r", encoding="utf-8")) - 1
    except Exception:
        rows = 0
    print(f"Wrote {rows} rows to {OUTPUT_CSV}")
    if rows <= 0:
        print("No rows extracted. See debug artifacts:", DEBUG_HTML, DEBUG_PNG, BESTIARY_NEXT_DATA_JSON)
        return 2
    return 0


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
    except KeyboardInterrupt:
        exit_code = 130
    except Exception as exc:
        print(f"Error: {exc}")
        exit_code = 1
    sys.exit(exit_code)

