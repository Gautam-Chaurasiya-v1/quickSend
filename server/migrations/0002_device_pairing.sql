CREATE TABLE IF NOT EXISTS device_pairings (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  public_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  sender_key TEXT,
  envelope TEXT
);
CREATE INDEX IF NOT EXISTS pairing_expiry ON device_pairings(expires_at);
