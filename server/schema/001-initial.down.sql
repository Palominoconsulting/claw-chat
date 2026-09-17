-- Destructive: only on a disposable empty/test database after explicit operator consent.
DROP TABLE messages;
DROP TABLE events;
DROP TABLE tasks;
DROP TABLE stages;
DROP TABLE snapshots;
DROP TABLE context_items;
DROP TABLE projects;
DROP TABLE metadata;
PRAGMA user_version=0;
