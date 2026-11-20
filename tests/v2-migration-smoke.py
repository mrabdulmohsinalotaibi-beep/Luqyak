#!/usr/bin/env python3
"""Non-destructive migration smoke test against a disposable in-memory SQLite DB."""
from pathlib import Path
import sqlite3

sql = Path("migrations/20261120_local_first_v2.sql").read_text()
db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT);
CREATE TABLE lk_meetups(id TEXT PRIMARY KEY, owner_id TEXT, title TEXT, ended INTEGER);
CREATE TABLE lk_meetup_photos(id TEXT PRIMARY KEY, meetup_id TEXT, object_key TEXT);
CREATE TABLE auth_sessions(token_hash TEXT, user_id TEXT, expires_at TEXT);
INSERT INTO users VALUES ('owner','person@example.test');
INSERT INTO lk_meetups VALUES ('meet-1','owner','Old memories',0);
INSERT INTO lk_meetup_photos VALUES ('photo-1','meet-1','meetup-albums/meet-1/photo-1.jpg');
""")
legacy = ["users", "lk_meetups", "lk_meetup_photos", "auth_sessions"]
def snapshot():
    return {
        table: (db.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'").fetchone(),
                db.execute(f"SELECT * FROM {table}").fetchall())
        for table in legacy
    }

before = snapshot()
db.executescript(sql)
assert snapshot() == before, "Migration changed a legacy table or its data"
db.executescript(sql)
assert snapshot() == before, "Repeat migration changed legacy data"
expected = {
    "lk_v2_device_keys", "lk_v2_meetup_shares", "lk_v2_photo_queue",
    "lk_v2_view_packages", "lk_v2_meetup_windows", "lk_v2_share_usage"
}
created = {x[0] for x in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert expected.issubset(created), f"Missing V2 tables: {expected-created}"
db.execute("INSERT INTO lk_v2_share_usage(share_id) VALUES ('share1')")
db.execute("UPDATE lk_v2_share_usage SET photo_count=photo_count+1,bytes_total=bytes_total+? WHERE share_id=? AND photo_count<100 AND bytes_total+?<=524288000",
           (1234, "share1", 1234))
assert db.execute("SELECT photo_count,bytes_total FROM lk_v2_share_usage").fetchone() == (1,1234)
print("PASS: additive and repeatable V2 D1 migration, intact legacy tables, functional quota update")
