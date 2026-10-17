PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  public_key TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES identities(id), created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES identities(id), status TEXT NOT NULL CHECK(status IN ('active','pending')),
  envelope TEXT, last_read_seq INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  PRIMARY KEY(room_id, user_id)
);
CREATE INDEX IF NOT EXISTS members_user ON members(user_id, status);
CREATE TRIGGER IF NOT EXISTS two_members BEFORE INSERT ON members
WHEN (SELECT COUNT(*) FROM members WHERE room_id=NEW.room_id) >= 2
BEGIN SELECT RAISE(ABORT, 'room_full'); END;
CREATE TABLE IF NOT EXISTS invites (
  token_hash TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL, claimed_by TEXT REFERENCES identities(id)
);
CREATE INDEX IF NOT EXISTS invites_room ON invites(room_id);
CREATE TABLE IF NOT EXISTS messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES identities(id), envelope TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_room_seq ON messages(room_id, seq DESC);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
