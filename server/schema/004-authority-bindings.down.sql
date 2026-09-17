-- Disposable test databases only. Reverting cannot recover missing historical authority.
-- Keep the additive JSON fields and conservative invalidation; old clients cannot be trusted to enforce them.
-- Production rollback: restore the pre-upgrade backup with its matching binary, offline.
PRAGMA user_version=3;
