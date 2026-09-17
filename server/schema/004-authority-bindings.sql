-- Existing admitted work has no verifiable admission/review contract. Preserve it for inspection;
-- never fabricate historical dependency receipts or recertify it. Use a new execution project.
UPDATE stages SET data=json_set(data,
  '$.reviewGeneration', 0,
  '$.launchToken', NULL,
  '$.dependencies', json('[]'),
  '$.dependencyStale', json(CASE WHEN json_extract(data,'$.snapshotId') IS NOT NULL THEN 'true' ELSE 'false' END),
  '$.approvedRevision', NULL,
  '$.status', CASE WHEN json_extract(data,'$.status')='approved' THEN 'review' ELSE json_extract(data,'$.status') END);
PRAGMA user_version=4;
