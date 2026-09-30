-- Local email verification does not establish ownership of a real mailbox.
-- A future live provider must require fresh verification in its own delivery mode.
ALTER TABLE customer_account ADD COLUMN email varchar(254);
ALTER TABLE customer_account ADD COLUMN pending_email varchar(254);
ALTER TABLE customer_account ADD COLUMN email_verified_at timestamptz;
ALTER TABLE customer_account ADD COLUMN email_verification_mode varchar(24);
CREATE UNIQUE INDEX verified_customer_email ON customer_account(lower(email))
  WHERE active AND email_verified_at IS NOT NULL;

CREATE TABLE customer_email_challenge (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customer_account(id),
  purpose varchar(12) NOT NULL CHECK(purpose IN ('VERIFY','RESET')),
  recipient varchar(254) NOT NULL,
  delivery_mode varchar(24) NOT NULL CHECK(delivery_mode='LOCAL_SMTP'),
  code_hash varchar(64) NOT NULL,
  payload text,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  delivery_attempts integer NOT NULL DEFAULT 0,
  delivery_status varchar(12) NOT NULL DEFAULT 'QUEUED'
    CHECK(delivery_status IN ('QUEUED','SENT','FAILED','CANCELLED')),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  UNIQUE(customer_id,purpose)
);
CREATE INDEX customer_email_pending ON customer_email_challenge(next_attempt_at)
  WHERE delivery_status='QUEUED';

-- One private platform operator. No HTTP registration or extra admin accounts.
-- Fail for manual review if an installation unexpectedly has multiple operators.
CREATE UNIQUE INDEX single_platform_operator ON platform_account((true));
