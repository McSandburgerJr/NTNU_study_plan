"""
Henter NTNUs emneliste og lagrer den som courses.json for Emneplanleggeren.

Bruk:
    pip install requests beautifulsoup4
    python scrape_courses.py                 # bare kode og navn (rask, ett kall)
    python scrape_courses.py --details       # henter også studiepoeng fra hver emneside (tar tid)
    python scrape_courses.py --details --limit 50   # test på 50 emner først

Kilde: https://www.ntnu.no/studier/emnesok/-/course_list/listall
Strukturen på NTNU-sidene kan endre seg; sjekk resultatet etter første kjøring.
"""
import argparse, json, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import requests
from bs4 import BeautifulSoup

LIST_URL = {"no": "https://www.ntnu.no/studier/emnesok/-/course_list/listall"}
# Den engelske A–Å-listen virker ikke, så engelske navn hentes fra søke-API-et på ntnu.edu
EN_API = ("https://www.ntnu.edu/web/studies/coursesearch?p_p_id=courselistportlet_WAR_courselistportlet"
          "&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=fetch-courselist-as-json"
          "&p_p_cacheability=cacheLevelPage")
COURSE_URL = "https://www.ntnu.no/studier/emner/{code}"
CODE_RE = re.compile(r"^[A-ZÆØÅ]{2,}\d{3,4}[A-Z]?$")
HEADERS = {"User-Agent": "Emneplanlegger/0.1 (studentprosjekt)"}


def fetch(url, session):
    r = session.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.text


def parse_list(html):
    """Finner alle lenker til emnesider og plukker ut kode + navn."""
    soup = BeautifulSoup(html, "html.parser")
    courses = {}
    for a in soup.find_all("a", href=True):
        m = re.search(r"/(?:studier/emner|studies/courses)/([^/?#]+)", a["href"])
        if not m:
            continue
        code = requests.utils.unquote(m.group(1)).upper()
        if not CODE_RE.match(code):
            continue
        text = " ".join(a.get_text(" ", strip=True).split())
        # Typisk "TMR4515 - Marin kybernetikk, fordypningsemne" eller bare navnet
        name = re.sub(rf"^{re.escape(code)}\s*[-–:]?\s*", "", text, flags=re.I).strip()
        # A–Å-listen viser "Emnenavn (KODE)"
        name = re.sub(rf"\s*\({re.escape(code)}\)\s*$", "", name, flags=re.I).strip()
        if name and code not in courses:
            courses[code] = name
    return courses


def fetch_english_names(session):
    """Blar gjennom søkeresultatene for inneværende og forrige år og samler engelske navn."""
    import datetime
    names, year = {}, datetime.date.today().year
    for sem in (year, year - 1):
        for page in range(1, 200):
            r = session.post(f"{EN_API}&semester={sem}&pageNo={page}&sortOrder=%2Btitle", headers=HEADERS, timeout=60)
            r.raise_for_status()
            courses = r.json().get("courses") or []
            if not courses:
                break
            for c in courses:
                if c.get("courseCode") and c.get("courseName"):
                    names.setdefault(c["courseCode"], c["courseName"].strip())
    return names


def fetch_credits(code, session):
    try:
        html = fetch(COURSE_URL.format(code=code), session)
    except requests.RequestException:
        return code, None
    text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    m = re.search(r"Studiepoeng\s*([\d]+(?:[.,]\d+)?)", text)
    return code, float(m.group(1).replace(",", ".")) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--details", action="store_true", help="hent studiepoeng fra hver emneside")
    ap.add_argument("--limit", type=int, default=0, help="begrens antall emner (for testing)")
    ap.add_argument("--workers", type=int, default=4, help="parallelle kall ved --details")
    ap.add_argument("--out", default="courses.json")
    args = ap.parse_args()

    s = requests.Session()
    no = parse_list(fetch(LIST_URL["no"], s))
    if not no:
        sys.exit("Fant ingen emner i listen. Sidestrukturen har kanskje endret seg.")
    print(f"Fant {len(no)} emner")
    try:
        en = fetch_english_names(s)
        print(f"Fant {len(en)} engelske navn")
    except requests.RequestException:
        en = {}

    codes = sorted(no)[: args.limit or None]
    credits = {}
    if args.details:
        def job(code):
            time.sleep(0.25)  # vær snill mot NTNUs server
            return fetch_credits(code, s)
        with ThreadPoolExecutor(args.workers) as pool:
            for i, (code, cr) in enumerate(pool.map(job, codes), 1):
                credits[code] = cr
                if i % 100 == 0:
                    print(f"  {i}/{len(codes)}")

    out = []
    for code in codes:
        item = {"code": code, "name": no[code], "credits": credits.get(code) or 7.5}
        if en.get(code) and en[code] != no[code]:
            item["name_en"] = en[code]
        out.append(item)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Skrev {len(out)} emner til {args.out}")


if __name__ == "__main__":
    main()
