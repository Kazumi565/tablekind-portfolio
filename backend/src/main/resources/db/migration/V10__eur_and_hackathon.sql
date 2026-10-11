-- Amounts in legacy *_bani columns are integer minor units in restaurant currency.
-- Existing values and currency are never converted or relabelled.
ALTER TABLE restaurant DROP CONSTRAINT restaurant_currency_check;
ALTER TABLE restaurant ADD CHECK (currency IN ('MDL','EUR'));
ALTER TABLE payment_attempt DROP CONSTRAINT payment_attempt_currency_check;
ALTER TABLE payment_attempt ADD CHECK (currency IN ('MDL','EUR'));
ALTER TABLE payment_attempt DROP CONSTRAINT payment_attempt_method_check;
ALTER TABLE payment_attempt ADD CHECK (method IN ('CARD','MIA','CASH','TERMINAL','PAYPAL'));

CREATE FUNCTION protect_restaurant_currency() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.currency <> OLD.currency THEN
    RAISE EXCEPTION 'Restaurant currency is immutable; create a separate restaurant' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_restaurant_currency BEFORE UPDATE ON restaurant
  FOR EACH ROW EXECUTE FUNCTION protect_restaurant_currency();

CREATE TABLE paypal_merchant (
  restaurant_id uuid PRIMARY KEY REFERENCES restaurant,
  merchant_id varchar(64) NOT NULL,
  environment varchar(10) NOT NULL DEFAULT 'SANDBOX' CHECK (environment='SANDBOX')
);
CREATE TABLE paypal_checkout (
  payment_id uuid PRIMARY KEY REFERENCES payment_attempt,
  merchant_id varchar(64) NOT NULL,
  order_id varchar(64) UNIQUE,
  capture_id varchar(64) UNIQUE,
  create_request_id uuid NOT NULL UNIQUE,
  capture_request_id uuid NOT NULL UNIQUE,
  phase varchar(24) NOT NULL DEFAULT 'CREATE' CHECK
    (phase IN ('CREATE','APPROVAL','CAPTURE','PENDING_CAPTURE','RESOLVED','REVIEW')),
  create_started_at timestamptz,
  capture_started_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  cancel_requested boolean NOT NULL DEFAULT false,
  last_message varchar(250) NOT NULL DEFAULT 'Preparing PayPal checkout',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX paypal_due ON paypal_checkout(next_attempt_at) WHERE phase NOT IN ('RESOLVED','REVIEW');

CREATE TABLE ai_split_draft (
  id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  session_id uuid NOT NULL,
  guest_id uuid NOT NULL,
  revision bigint NOT NULL,
  preview jsonb NOT NULL,
  proposal_id uuid REFERENCES allocation_proposal,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  FOREIGN KEY (restaurant_id,session_id,guest_id) REFERENCES guest(restaurant_id,session_id,id)
);
CREATE TABLE ai_usage (
  id uuid PRIMARY KEY,
  guest_id uuid NOT NULL REFERENCES guest,
  model varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
