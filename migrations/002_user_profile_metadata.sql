ALTER TABLE haneul_users
  ADD COLUMN IF NOT EXISTS avatar_key TEXT NOT NULL DEFAULT 'cloud';

UPDATE haneul_users
SET avatar_key = 'cloud'
WHERE avatar_key IS NULL OR avatar_key = '';
