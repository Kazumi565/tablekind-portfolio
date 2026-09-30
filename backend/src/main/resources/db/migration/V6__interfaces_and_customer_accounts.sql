-- Distinct platform, restaurant and customer identities. Financial records are unchanged.
ALTER TABLE membership DROP CONSTRAINT membership_role_check;
ALTER TABLE membership ADD CONSTRAINT membership_role_check CHECK(role IN ('OWNER','MANAGER','WAITER'));

-- Only recorded restaurant creators still holding manager access are promoted.
-- Restaurants without this evidence remain unassigned until the platform administrator reviews them.
WITH creators AS (
  SELECT DISTINCT ON (restaurant_id) restaurant_id,actor_id
  FROM audit_event WHERE action='RESTAURANT_CREATED' ORDER BY restaurant_id,id
)
UPDATE membership m SET role='OWNER' FROM creators c
WHERE m.restaurant_id=c.restaurant_id AND m.staff_id=c.actor_id AND m.role='MANAGER'
  AND EXISTS(SELECT 1 FROM staff_account a WHERE a.id=m.staff_id AND a.active);
CREATE UNIQUE INDEX one_restaurant_owner ON membership(restaurant_id) WHERE role='OWNER';

CREATE TABLE platform_account (
  id uuid PRIMARY KEY, email varchar(254) NOT NULL UNIQUE,
  password_hash varchar(100) NOT NULL, mfa_secret text NOT NULL,
  mfa_last_step bigint NOT NULL DEFAULT -1, recovery_hash varchar(64) NOT NULL,
  mfa_pending text, mfa_pending_until timestamptz,
  token_version integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_audit (
  id bigserial PRIMARY KEY, actor_id uuid NOT NULL REFERENCES platform_account(id),
  action varchar(60) NOT NULL, restaurant_id uuid REFERENCES restaurant(id),
  reason varchar(400) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_platform_audit BEFORE UPDATE OR DELETE ON platform_audit
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE TABLE customer_account (
  id uuid PRIMARY KEY, username varchar(40) NOT NULL UNIQUE,
  display_name varchar(40) NOT NULL, language varchar(2) NOT NULL DEFAULT 'en'
    CHECK(language IN ('en','ro','ru')),
  password_hash varchar(100) NOT NULL, recovery_hash varchar(64) NOT NULL,
  active boolean NOT NULL DEFAULT true, token_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE guest ADD COLUMN customer_id uuid REFERENCES customer_account(id);
CREATE UNIQUE INDEX one_customer_per_table ON guest(customer_id,session_id) WHERE customer_id IS NOT NULL;
CREATE INDEX customer_visits ON guest(customer_id,joined_at DESC) WHERE customer_id IS NOT NULL;
CREATE TABLE customer_security_event (
  id bigserial PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customer_account(id),
  action varchar(60) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_customer_security BEFORE UPDATE OR DELETE ON customer_security_event
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
