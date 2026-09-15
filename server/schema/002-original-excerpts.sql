-- Preserve original capture alongside later interpretations. Never reconstruct edited speech.
UPDATE context_items SET data=json_set(data,
  '$.originalText', CASE WHEN json_extract(data,'$.kind')='source_excerpt' THEN json_extract(data,'$.text') ELSE NULL END,
  '$.originalHash', CASE WHEN json_extract(data,'$.kind')='source_excerpt' THEN json_extract(data,'$.hash') ELSE NULL END)
WHERE json_type(data,'$.originalText') IS NULL;
PRAGMA user_version=2;
