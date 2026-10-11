ALTER TABLE ai_usage ADD COLUMN request_hash varchar(64);
ALTER TABLE ai_usage ADD COLUMN result jsonb;
CREATE INDEX ai_usage_guest_time ON ai_usage(guest_id,created_at);
