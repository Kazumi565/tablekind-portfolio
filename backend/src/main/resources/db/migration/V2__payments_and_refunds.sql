ALTER TABLE checkout_reservation DROP CONSTRAINT checkout_reservation_status_check;
ALTER TABLE checkout_reservation ADD CONSTRAINT checkout_reservation_status_check
  CHECK(status IN ('HELD','RELEASED','EXPIRED','PROCESSING','SETTLED'));

CREATE TABLE payment_attempt (
  id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL,
  payer_id uuid NOT NULL, reservation_id uuid NOT NULL UNIQUE,
  method varchar(16) NOT NULL CHECK(method IN ('CARD','MIA','CASH','TERMINAL')),
  provider varchar(40) NOT NULL, is_test boolean NOT NULL,
  amount_bani bigint NOT NULL CHECK(amount_bani BETWEEN 1 AND 1000000000),
  tip_bani bigint NOT NULL CHECK(tip_bani BETWEEN 0 AND 100000000),
  currency varchar(3) NOT NULL DEFAULT 'MDL' CHECK(currency='MDL'),
  status varchar(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  received_bani bigint CHECK(received_bani BETWEEN 1 AND 2000000000),
  change_bani bigint CHECK(change_bani>=0), manual_reference varchar(120), confirmed_by uuid REFERENCES staff_account,
  created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
  UNIQUE(restaurant_id,session_id,id),
  FOREIGN KEY(restaurant_id,session_id,payer_id) REFERENCES guest(restaurant_id,session_id,id),
  FOREIGN KEY(restaurant_id,session_id,reservation_id) REFERENCES checkout_reservation(restaurant_id,session_id,id)
);
CREATE INDEX payments_by_session ON payment_attempt(session_id,created_at);
CREATE UNIQUE INDEX unique_terminal_reference ON payment_attempt(restaurant_id,manual_reference)
  WHERE method='TERMINAL' AND status='SUCCEEDED';

CREATE TABLE payment_refund (
  id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL, payment_id uuid NOT NULL,
  amount_bani bigint NOT NULL CHECK(amount_bani BETWEEN 0 AND 1000000000),
  tip_bani bigint NOT NULL CHECK(tip_bani BETWEEN 0 AND 100000000),
  mode varchar(24) NOT NULL CHECK(mode IN ('REDUCE_BILL','RETURN_PAYMENT')),
  reason varchar(400) NOT NULL, requested_by uuid NOT NULL REFERENCES staff_account,
  status varchar(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  confirmed_by uuid REFERENCES staff_account, manual_reference varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
  CHECK(amount_bani+tip_bani>0), UNIQUE(restaurant_id,session_id,id),
  FOREIGN KEY(restaurant_id,session_id,payment_id) REFERENCES payment_attempt(restaurant_id,session_id,id)
);
CREATE TABLE refund_part (
  restaurant_id uuid NOT NULL, session_id uuid NOT NULL, refund_id uuid NOT NULL,
  item_id uuid NOT NULL, guest_id uuid NOT NULL, amount_bani bigint NOT NULL CHECK(amount_bani>0),
  PRIMARY KEY(refund_id,item_id,guest_id),
  FOREIGN KEY(restaurant_id,session_id,refund_id) REFERENCES payment_refund(restaurant_id,session_id,id),
  FOREIGN KEY(restaurant_id,session_id,item_id) REFERENCES order_item(restaurant_id,session_id,id),
  FOREIGN KEY(restaurant_id,session_id,guest_id) REFERENCES guest(restaurant_id,session_id,id)
);
ALTER TABLE settlement_entry ADD COLUMN payment_id uuid;
ALTER TABLE settlement_entry ADD COLUMN refund_id uuid;
ALTER TABLE settlement_entry ADD FOREIGN KEY(restaurant_id,session_id,payment_id) REFERENCES payment_attempt(restaurant_id,session_id,id);
ALTER TABLE settlement_entry ADD FOREIGN KEY(restaurant_id,session_id,refund_id) REFERENCES payment_refund(restaurant_id,session_id,id);
ALTER TABLE settlement_entry ADD CHECK(refund_id IS NULL OR payment_id IS NOT NULL);
CREATE UNIQUE INDEX one_payment_portion ON settlement_entry(payment_id,item_id,guest_id) WHERE payment_id IS NOT NULL AND refund_id IS NULL;
CREATE UNIQUE INDEX one_refund_portion ON settlement_entry(refund_id,item_id,guest_id) WHERE refund_id IS NOT NULL;
CREATE INDEX settlements_by_payment ON settlement_entry(payment_id);
CREATE UNIQUE INDEX unique_terminal_refund_reference ON payment_refund(restaurant_id,manual_reference)
  WHERE manual_reference IS NOT NULL AND manual_reference<>'' AND status='SUCCEEDED';

-- Provider simulator storage. Only the local profile exposes a controller that can change these intents.
CREATE TABLE test_provider_intent (
  id uuid PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurant,
  kind varchar(10) NOT NULL CHECK(kind IN ('PAYMENT','REFUND')),
  amount_bani bigint NOT NULL CHECK(amount_bani>0), currency varchar(3) NOT NULL CHECK(currency='MDL'),
  status varchar(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment_webhook (
  provider varchar(40) NOT NULL, event_id uuid NOT NULL, fingerprint varchar(64) NOT NULL,
  intent_id uuid NOT NULL, outcome varchar(40) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,event_id)
);
CREATE TRIGGER immutable_payment_webhooks BEFORE UPDATE OR DELETE ON payment_webhook FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER immutable_refund_parts BEFORE UPDATE OR DELETE ON refund_part FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE FUNCTION check_payment_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid; p payment_attempt%ROWTYPE; original bigint; refunded bigint; settled bigint;
BEGIN
  IF TG_TABLE_NAME='payment_attempt' THEN pid=NEW.id; ELSE pid=NEW.payment_id; END IF;
  IF pid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM payment_attempt WHERE id=pid;
  SELECT coalesce(sum(amount_bani),0) INTO original FROM reservation_part WHERE reservation_id=p.reservation_id;
  IF original<>p.amount_bani THEN RAISE EXCEPTION 'Payment must match its exact reservation' USING ERRCODE='23514'; END IF;
  SELECT coalesce(sum(amount_bani),0) INTO refunded FROM payment_refund WHERE payment_id=pid AND status='SUCCEEDED';
  SELECT coalesce(sum(amount_bani),0) INTO settled FROM settlement_entry WHERE payment_id=pid;
  IF settled<>(CASE WHEN p.status='SUCCEEDED' THEN p.amount_bani-refunded ELSE 0 END) THEN
    RAISE EXCEPTION 'Payment settlement must match confirmed provider/manual outcome' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM payment_refund WHERE payment_id=pid AND status IN ('PENDING','SUCCEEDED')
    HAVING sum(amount_bani)>p.amount_bani OR sum(tip_bani)>p.tip_bani) THEN
    RAISE EXCEPTION 'Refund exceeds original payment' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM payment_refund r WHERE r.payment_id=pid AND r.amount_bani<>
    (SELECT coalesce(sum(amount_bani),0) FROM refund_part WHERE refund_id=r.id)) THEN
    RAISE EXCEPTION 'Refund portions must equal refund amount' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM settlement_entry s WHERE s.payment_id=pid AND s.refund_id IS NULL AND
    (s.amount_bani<=0 OR s.amount_bani<>coalesce((SELECT amount_bani FROM reservation_part x WHERE x.reservation_id=p.reservation_id AND x.item_id=s.item_id AND x.guest_id=s.guest_id),0))) THEN
    RAISE EXCEPTION 'Settlement must preserve original payment portions' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM settlement_entry s LEFT JOIN payment_refund r ON r.id=s.refund_id
    WHERE s.payment_id=pid AND s.refund_id IS NOT NULL AND
    (r.payment_id<>pid OR r.status<>'SUCCEEDED' OR s.amount_bani>=0 OR -s.amount_bani<>
      coalesce((SELECT amount_bani FROM refund_part x WHERE x.refund_id=r.id AND x.item_id=s.item_id AND x.guest_id=s.guest_id),0))) THEN
    RAISE EXCEPTION 'Refund settlement must preserve original refund portions' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM refund_part x JOIN payment_refund r ON r.id=x.refund_id
    WHERE r.payment_id=pid AND r.status IN ('PENDING','SUCCEEDED') GROUP BY x.item_id,x.guest_id
    HAVING sum(x.amount_bani)>coalesce((SELECT amount_bani FROM reservation_part z WHERE z.reservation_id=p.reservation_id AND z.item_id=x.item_id AND z.guest_id=x.guest_id),0)) THEN
    RAISE EXCEPTION 'Refund portions exceed their original payment' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER payment_balanced AFTER INSERT OR UPDATE ON payment_attempt DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_payment_ledger();
CREATE CONSTRAINT TRIGGER refund_balanced AFTER INSERT OR UPDATE ON payment_refund DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_payment_ledger();
CREATE CONSTRAINT TRIGGER payment_settlements_balanced AFTER INSERT ON settlement_entry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_payment_ledger();
