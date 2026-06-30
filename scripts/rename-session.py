import json
import sqlite3
from pathlib import Path

SESSION_ID = "019f0dc6-dd82-70f2-8bfd-1d1a94c1571d"
NEW_TITLE = "Void.Store"
GROK_HOME = Path.home() / ".grok"
SESSION_DIR = GROK_HOME / "sessions" / "C%3A%5CUsers%5CUser" / SESSION_ID
SUMMARY_FILE = SESSION_DIR / "summary.json"
SQLITE_FILE = GROK_HOME / "sessions" / "session_search.sqlite"

summary = json.loads(SUMMARY_FILE.read_text(encoding="utf-8"))
summary["session_summary"] = NEW_TITLE
summary["generated_title"] = NEW_TITLE
SUMMARY_FILE.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Updated {SUMMARY_FILE}")

if SQLITE_FILE.exists():
    conn = sqlite3.connect(SQLITE_FILE)
    cur = conn.cursor()
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    print("tables:", tables)
    for table in tables:
        cols = [r[1] for r in cur.execute(f"PRAGMA table_info({table})")]
        if "session_id" in cols:
            sets = []
            params = []
            for col in ("title", "summary", "generated_title", "session_summary"):
                if col in cols:
                    sets.append(f"{col} = ?")
                    params.append(NEW_TITLE)
            if sets:
                params.append(SESSION_ID)
                sql = f"UPDATE {table} SET {', '.join(sets)} WHERE session_id = ?"
                cur.execute(sql, params)
                print(f"Updated {table}: {cur.rowcount} row(s)")
    conn.commit()
    conn.close()

print("Done:", NEW_TITLE)