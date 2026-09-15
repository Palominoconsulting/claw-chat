-- Destructive to original capture metadata; use only on disposable test databases.
UPDATE context_items SET data=json_remove(data,'$.originalText','$.originalHash');
PRAGMA user_version=1;
