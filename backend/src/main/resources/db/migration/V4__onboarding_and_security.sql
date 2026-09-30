ALTER TABLE branch ADD COLUMN operating_mode varchar(20) NOT NULL DEFAULT 'ORDER_AND_PAY'
  CHECK (operating_mode IN ('ORDER_AND_PAY','PAY_AT_TABLE'));
ALTER TABLE branch ADD COLUMN languages jsonb NOT NULL DEFAULT '["en","ro","ru"]';
ALTER TABLE branch ADD COLUMN default_language varchar(2) NOT NULL DEFAULT 'en'
  CHECK (default_language IN ('en','ro','ru'));
ALTER TABLE dining_table ADD COLUMN qr_version uuid;
ALTER TABLE staff_account ADD COLUMN mfa_secret text;
ALTER TABLE staff_account ADD COLUMN mfa_pending text;
ALTER TABLE staff_account ADD COLUMN mfa_pending_until timestamptz;
ALTER TABLE staff_account ADD COLUMN mfa_last_step bigint NOT NULL DEFAULT -1;
CREATE TABLE auth_recovery_code (
  staff_id uuid NOT NULL REFERENCES staff_account(id),
  code_hash varchar(64) NOT NULL,
  PRIMARY KEY(staff_id, code_hash)
);
CREATE TABLE request_limit (
  bucket varchar(64) PRIMARY KEY,
  window_start bigint NOT NULL,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX request_limit_expiry ON request_limit(expires_at);
CREATE TABLE security_event (
  id bigserial PRIMARY KEY,
  staff_id uuid REFERENCES staff_account(id),
  action varchar(60) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_event_account ON security_event(staff_id,id DESC);
CREATE TRIGGER immutable_security_event BEFORE UPDATE OR DELETE ON security_event
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
