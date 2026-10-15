#!/usr/bin/env python3
"""Build src/data/artists.json from public Wikidata, Wikipedia and Wikimedia Commons data.

Every profile is a real person with an English Wikipedia article and a Wikidata link
to Miami (born in, lives in, or works in). Links come only from Wikidata statements;
photos only from Wikimedia Commons with their license and author recorded.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

UA = "DevinConvergeDemo/0.1 (https://github.com/vicerobotics-christian/Devin-AI-Converge-Demo)"
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "artists.json"
TARGET = 200

DISCIPLINES = {
    "music": {"Q177220", "Q639669", "Q2252262", "Q183945", "Q130857", "Q36834", "Q855091", "Q386854", "Q753110", "Q488205", "Q1259917"},
    "visual": {"Q1028181", "Q483501", "Q1281618", "Q15296811", "Q3391743", "Q11569986", "Q1925963", "Q627325", "Q7541856"},
    "photo": {"Q33231"},
    "film": {"Q2526255", "Q3455803", "Q2259451", "Q7042855", "Q28389", "Q1414443"},
    "dance": {"Q5716684", "Q2490358"},
    "writing": {"Q36180", "Q49757", "Q6625963", "Q4853732"},
    "theater": {"Q2259451", "Q33999", "Q10800557", "Q10798782"},
    "design": {"Q5322166", "Q15214752", "Q1930187"},
}
QUOTA = {"music": 64, "visual": 40, "film": 22, "writing": 22, "photo": 12, "dance": 14, "theater": 16, "design": 6}
PRIORITY = ["dance", "photo", "design", "visual", "theater", "film", "writing", "music"]

LINK_PROPS = {
    "website": "P856",
    "instagram": "P2003",
    "x": "P2002",
    "tiktok": "P7085",
    "youtube": "P2397",
    "spotify": "P1902",
    "soundcloud": "P3040",
    "bandcamp": "P3283",
    "applemusic": "P2850",
    "facebook": "P2013",
    "imdb": "P345",
}
LINK_URL = {
    "website": "{}",
    "instagram": "https://www.instagram.com/{}/",
    "x": "https://x.com/{}",
    "tiktok": "https://www.tiktok.com/@{}",
    "youtube": "https://www.youtube.com/channel/{}",
    "spotify": "https://open.spotify.com/artist/{}",
    "soundcloud": "https://soundcloud.com/{}",
    "bandcamp": "https://{}.bandcamp.com/",
    "applemusic": "https://music.apple.com/us/artist/{}",
    "facebook": "https://www.facebook.com/{}",
    "imdb": "https://www.imdb.com/name/{}/",
}


def get(url, data=None, accept="application/json", retries=4):
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": accept})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())
        except Exception as e:  # noqa: BLE001
            wait = 5 * (attempt + 1)
            print(f"  retry {attempt + 1} after {e} ({wait}s)", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"failed: {url[:120]}")


def sparql(query):
    body = urllib.parse.urlencode({"query": query}).encode()
    return get("https://query.wikidata.org/sparql", data=body, accept="application/sparql-results+json")["results"]["bindings"]


def qid(uri):
    return uri.rsplit("/", 1)[-1]


def candidates():
    occs = " ".join(f"wd:{q}" for s in DISCIPLINES.values() for q in s)
    people = defaultdict(lambda: {"rels": set(), "occs": set()})
    for rel, pid in (("born", "P19"), ("lives", "P551"), ("works", "P937")):
        rows = sparql(f"""
SELECT ?person ?occ ?birth ?died ?article WHERE {{
  ?person wdt:{pid} wd:Q8652 ; wdt:P106 ?occ .
  VALUES ?occ {{ {occs} }}
  OPTIONAL {{ ?person wdt:P569 ?birth }}
  OPTIONAL {{ ?person wdt:P570 ?died }}
  OPTIONAL {{ ?article schema:about ?person ; schema:isPartOf <https://en.wikipedia.org/> }}
}}""")
        for r in rows:
            if "died" in r or "article" not in r or r.get("birth", {}).get("value", "2000") < "1940":
                continue
            p = people[qid(r["person"]["value"])]
            p["rels"].add(rel)
            p["occs"].add(qid(r["occ"]["value"]))
            p["article"] = r["article"]["value"]
        print(f"  {rel}: {len(people)} total", file=sys.stderr)
        time.sleep(2)
    return people


def details(ids):
    out = {}
    for i in range(0, len(ids), 60):
        chunk = ids[i:i + 60]
        values = " ".join(f"wd:{q}" for q in chunk)
        props = " ".join(f"OPTIONAL {{ ?p wdt:{pid} ?{k} }}" for k, pid in LINK_PROPS.items())
        sel = " ".join(f"(SAMPLE(?{k}) AS ?{k}_)" for k in LINK_PROPS)
        rows = sparql(f"""
SELECT ?p ?pLabel ?pDescription (SAMPLE(?img) AS ?img_) (SAMPLE(?mb) AS ?mb_) (SAMPLE(?email) AS ?email_) {sel}
  (GROUP_CONCAT(DISTINCT ?occL; separator="|") AS ?occs)
  (GROUP_CONCAT(DISTINCT ?genreL; separator="|") AS ?genres)
  (GROUP_CONCAT(DISTINCT ?instL; separator="|") AS ?instruments)
  (GROUP_CONCAT(DISTINCT ?movL; separator="|") AS ?movements)
WHERE {{
  VALUES ?p {{ {values} }}
  OPTIONAL {{ ?p wdt:P18 ?img }}
  OPTIONAL {{ ?p wdt:P434 ?mb }}
  OPTIONAL {{ ?p wdt:P968 ?email }}
  {props}
  OPTIONAL {{ ?p wdt:P106 ?o . ?o rdfs:label ?occL FILTER(LANG(?occL)="en") }}
  OPTIONAL {{ ?p wdt:P136 ?g . ?g rdfs:label ?genreL FILTER(LANG(?genreL)="en") }}
  OPTIONAL {{ ?p wdt:P1303 ?ins . ?ins rdfs:label ?instL FILTER(LANG(?instL)="en") }}
  OPTIONAL {{ ?p wdt:P135 ?m . ?m rdfs:label ?movL FILTER(LANG(?movL)="en") }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}} GROUP BY ?p ?pLabel ?pDescription""")
        for r in rows:
            v = lambda k: r.get(k, {}).get("value")  # noqa: E731
            split = lambda k: [s for s in (v(k) or "").split("|") if s]  # noqa: E731
            out[qid(r["p"]["value"])] = {
                "name": v("pLabel"),
                "description": v("pDescription"),
                "image": v("img_"),
                "musicbrainz": v("mb_"),
                "email": (v("email_") or "").removeprefix("mailto:") or None,
                "links": {k: v(f"{k}_") for k in LINK_PROPS if v(f"{k}_")},
                "occupations": split("occs"),
                "genres": split("genres"),
                "instruments": split("instruments"),
                "movements": split("movements"),
            }
        print(f"  details {i + len(chunk)}/{len(ids)}", file=sys.stderr)
        time.sleep(1)
    return out


DESC_WORDS = {
    "music": r"singer|rapper|musician|producer|composer|songwriter|dj|disc jockey|guitarist|drummer|pianist|band|record",
    "visual": r"painter|sculptor|illustrator|printmaker|ceramicist|muralist|(?<!recording )(?<!video )(?<!martial )(?<!hip hop )(?<!musical )artist",
    "photo": r"photographer",
    "film": r"film director|filmmaker|director|cinematographer|screenwriter|video artist",
    "dance": r"dancer|choreographer|ballet",
    "writing": r"writer|author|poet|novelist|journalist|essayist",
    "theater": r"actor|actress|playwright|stage",
    "design": r"designer|architect",
}


def classify(labels, description):
    """Order disciplines by where they first appear in the person's own description, then occupation list."""
    desc = (description or "").lower()
    occ = " | ".join(labels).lower()

    def pos(d, text):
        m = re.search(rf"\b({DESC_WORDS[d]})", text)
        return m.start() if m else 10_000

    hits = [d for d in PRIORITY if pos(d, occ) < 10_000 or pos(d, desc) < 10_000]
    return sorted(hits, key=lambda d: (pos(d, desc), pos(d, occ), PRIORITY.index(d)))


def musicbrainz_genres(mbid):
    data = get(f"https://musicbrainz.org/ws/2/artist/{mbid}?inc=genres+tags&fmt=json", retries=2)
    items = sorted(data.get("genres") or [], key=lambda g: -g.get("count", 0))
    return [g["name"] for g in items[:8]]


def summaries(titles):
    out = {}
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        q = urllib.parse.urlencode({
            "action": "query", "format": "json", "prop": "extracts", "exintro": 1, "explaintext": 1,
            "exsentences": 3, "titles": "|".join(chunk),
        })
        # No redirect following: a sitelink that redirects (e.g. to an award or film page) is not about the person.
        data = get(f"https://en.wikipedia.org/w/api.php?{q}")
        norm = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for page in data["query"]["pages"].values():
            t = page.get("title")
            out[norm.get(t, t)] = page.get("extract", "")
        time.sleep(1)
    return out


def image_meta(files):
    out = {}
    for i in range(0, len(files), 40):
        chunk = files[i:i + 40]
        q = urllib.parse.urlencode({
            "action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata",
            "iiurlwidth": 480, "titles": "|".join(f"File:{f}" for f in chunk),
        })
        data = get(f"https://commons.wikimedia.org/w/api.php?{q}")
        norm = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for page in data["query"]["pages"].values():
            info = (page.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            title = norm.get(page.get("title"), page.get("title", ""))
            strip = lambda s: re.sub(r"<[^>]+>", "", s or "").strip()  # noqa: E731
            if info.get("thumburl"):
                out[title.removeprefix("File:")] = {
                    "src": info["thumburl"],
                    "page": info.get("descriptionurl"),
                    "author": strip(meta.get("Artist", {}).get("value"))[:120] or "Unknown",
                    "license": strip(meta.get("LicenseShortName", {}).get("value")) or "See source",
                }
        time.sleep(1)
    return out


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main():
    print("candidates…", file=sys.stderr)
    people = candidates()
    print(f"  {len(people)} candidates", file=sys.stderr)
    info = details(list(people))
    titles = {q: urllib.parse.unquote(p["article"].rsplit("/", 1)[-1]).replace("_", " ") for q, p in people.items()}
    print("summaries…", file=sys.stderr)
    extracts = summaries(list(titles.values()))
    scored = []
    for q, p in people.items():
        d = info.get(q)
        if not d or not d["name"] or d["name"] == q or not extracts.get(titles[q], "").strip():
            continue
        if any("pornographic" in o.lower() for o in d["occupations"]):
            continue
        disc = classify(d["occupations"], d["description"])
        if not disc:
            continue
        score = len(d["links"]) * 2 + (3 if d["image"] else 0) + len(d["genres"]) * 0.5
        scored.append((score, q, disc))
    scored.sort(reverse=True)

    chosen, counts = [], defaultdict(int)
    for score, q, disc in scored:
        if counts[disc[0]] < QUOTA[disc[0]]:
            counts[disc[0]] += 1
            chosen.append((q, disc[0]))
    picked = {q for q, _ in chosen}
    for score, q, disc in scored:
        if len(chosen) >= TARGET:
            break
        if q not in picked:
            chosen.append((q, disc[0]))
            picked.add(q)
    print(f"  chose {len(chosen)}: {dict(counts)}", file=sys.stderr)

    files = [urllib.parse.unquote(info[q]["image"].rsplit("/", 1)[-1]).replace("_", " ") for q, _ in chosen if info[q]["image"]]
    print("images…", file=sys.stderr)
    images = image_meta(files)
    mb = {}
    with_mb = [q for q, _ in chosen if info[q]["musicbrainz"]]
    print(f"musicbrainz genres for {len(with_mb)}…", file=sys.stderr)
    for i, q in enumerate(with_mb):
        try:
            mb[q] = musicbrainz_genres(info[q]["musicbrainz"])
        except RuntimeError:
            mb[q] = []
        time.sleep(1.1)
        if i % 25 == 24:
            print(f"  {i + 1}/{len(with_mb)}", file=sys.stderr)

    artists, slugs = [], set()
    for q, disc in chosen:
        d, p = info[q], people[q]
        slug = slugify(d["name"])
        if slug in slugs:
            slug = f"{slug}-{q.lower()}"
        slugs.add(slug)
        img = None
        if d["image"]:
            img = images.get(urllib.parse.unquote(d["image"].rsplit("/", 1)[-1]).replace("_", " "))
        links = [{"type": k, "url": LINK_URL[k].format(urllib.parse.quote(val, safe=":/?=&.-_@~")) if k != "website" else val}
                 for k, val in d["links"].items()]
        artists.append({
            "id": slug,
            "name": d["name"],
            "discipline": disc,
            "disciplines": [disc] + [x for x in classify(d["occupations"], d["description"]) if x != disc],
            # Birth years in Wikidata descriptions sometimes conflict with the article; the bio carries dates.
            "tagline": re.sub(r"\s*\((born |b\. ?)?\d{4}\)", "", d["description"] or "").strip(),
            "bio": extracts.get(titles[q], "").strip(),
            "miami": sorted(p["rels"]),
            "occupations": d["occupations"],
            "genres": list(dict.fromkeys(g.lower() for g in mb.get(q, []) + d["genres"]))[:8],
            "genreSource": "MusicBrainz + Wikidata" if mb.get(q) else "Wikidata",
            "email": d["email"],
            "instruments": d["instruments"][:5],
            "movements": d["movements"][:3],
            "links": links,
            "photo": img,
            "sources": {"wikipedia": people[q]["article"], "wikidata": f"https://www.wikidata.org/wiki/{q}"},
        })
    artists.sort(key=lambda a: a["name"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "generatedAt": time.strftime("%Y-%m-%d"),
        "attribution": "Profile text from Wikipedia (CC BY-SA 4.0); facts and links from Wikidata (CC0); photos from Wikimedia Commons under their listed licenses.",
        "artists": artists,
    }, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {len(artists)} artists to {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
