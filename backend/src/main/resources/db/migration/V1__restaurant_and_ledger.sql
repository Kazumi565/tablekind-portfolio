CREATE TABLE restaurant (
    id uuid PRIMARY KEY, name varchar(120) NOT NULL, currency varchar(3) NOT NULL DEFAULT 'MDL' CHECK (currency = 'MDL'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE staff_account (
    id uuid PRIMARY KEY, email varchar(254) NOT NULL UNIQUE, display_name varchar(80) NOT NULL,
    password_hash varchar(100) NOT NULL, active boolean NOT NULL DEFAULT true, token_version int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE membership (
    restaurant_id uuid NOT NULL REFERENCES restaurant, staff_id uuid NOT NULL REFERENCES staff_account,
    role varchar(16) NOT NULL CHECK(role IN ('MANAGER','WAITER')), PRIMARY KEY(restaurant_id,staff_id)
);
CREATE TABLE branch (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurant, name varchar(120) NOT NULL,
    timezone varchar(60) NOT NULL DEFAULT 'Europe/Chisinau', approval_required boolean NOT NULL DEFAULT true,
    accepting_orders boolean NOT NULL DEFAULT true, hours jsonb NOT NULL DEFAULT '[]', UNIQUE(restaurant_id,id)
);
CREATE TABLE dining_table (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, branch_id uuid NOT NULL, label varchar(40) NOT NULL,
    pilot_enabled boolean NOT NULL DEFAULT true, max_guests int NOT NULL DEFAULT 20 CHECK(max_guests BETWEEN 1 AND 20),
    UNIQUE(restaurant_id,id), UNIQUE(branch_id,label), FOREIGN KEY(restaurant_id,branch_id) REFERENCES branch(restaurant_id,id)
);
CREATE TABLE category (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurant, names jsonb NOT NULL,
    sort_order int NOT NULL DEFAULT 0, UNIQUE(restaurant_id,id)
);
CREATE TABLE product (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, category_id uuid NOT NULL, names jsonb NOT NULL,
    descriptions jsonb NOT NULL DEFAULT '{}', allergens jsonb NOT NULL DEFAULT '[]', dietary_labels jsonb NOT NULL DEFAULT '[]',
    price_bani bigint NOT NULL CHECK(price_bani BETWEEN 0 AND 10000000), available boolean NOT NULL DEFAULT true,
    version int NOT NULL DEFAULT 1, UNIQUE(restaurant_id,id), FOREIGN KEY(restaurant_id,category_id) REFERENCES category(restaurant_id,id)
);
CREATE TABLE modifier_group (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, product_id uuid NOT NULL, names jsonb NOT NULL,
    min_select int NOT NULL CHECK(min_select BETWEEN 0 AND 20), max_select int NOT NULL CHECK(max_select BETWEEN 1 AND 20 AND max_select>=min_select),
    UNIQUE(restaurant_id,id), FOREIGN KEY(restaurant_id,product_id) REFERENCES product(restaurant_id,id)
);
CREATE TABLE modifier_option (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, group_id uuid NOT NULL, names jsonb NOT NULL,
    price_bani bigint NOT NULL CHECK(price_bani BETWEEN 0 AND 10000000), available boolean NOT NULL DEFAULT true,
    UNIQUE(restaurant_id,id), FOREIGN KEY(restaurant_id,group_id) REFERENCES modifier_group(restaurant_id,id)
);
CREATE TABLE table_session (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, table_id uuid NOT NULL, status varchar(12) NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','CLOSED')),
    revision bigint NOT NULL DEFAULT 0, qr_hash varchar(64) NOT NULL UNIQUE, qr_expires_at timestamptz NOT NULL,
    opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
    UNIQUE(restaurant_id,id), FOREIGN KEY(restaurant_id,table_id) REFERENCES dining_table(restaurant_id,id)
);
CREATE UNIQUE INDEX one_open_session_per_table ON table_session(table_id) WHERE status='OPEN';
CREATE TABLE guest (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL, nickname varchar(40) NOT NULL,
    active boolean NOT NULL DEFAULT true, token_version int NOT NULL DEFAULT 0, joined_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(restaurant_id,session_id,id), FOREIGN KEY(restaurant_id,session_id) REFERENCES table_session(restaurant_id,id)
);
CREATE TABLE order_item (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL, product_id uuid NOT NULL,
    ordered_by uuid NOT NULL, served_to uuid NOT NULL, quantity int NOT NULL CHECK(quantity BETWEEN 1 AND 20),
    unit_price_bani bigint NOT NULL CHECK(unit_price_bani>=0), product_version int NOT NULL,
    snapshot jsonb NOT NULL, status varchar(16) NOT NULL CHECK(status IN('SUBMITTED','ACCEPTED','PREPARING','READY','SERVED','REJECTED','CANCELLED')),
    note varchar(400) NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,ordered_by) REFERENCES guest(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,served_to) REFERENCES guest(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,product_id) REFERENCES product(restaurant_id,id)
);
CREATE TABLE bill_entry (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL, item_id uuid NOT NULL,
    amount_bani bigint NOT NULL, kind varchar(32) NOT NULL, reason varchar(400) NOT NULL, batch_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(restaurant_id,session_id,item_id) REFERENCES order_item(restaurant_id,session_id,id)
);
CREATE TABLE allocation_entry (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL, item_id uuid NOT NULL, guest_id uuid NOT NULL,
    amount_bani bigint NOT NULL, reason varchar(400) NOT NULL, batch_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(restaurant_id,session_id,item_id) REFERENCES order_item(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,guest_id) REFERENCES guest(restaurant_id,session_id,id)
);
CREATE INDEX allocations_by_item ON allocation_entry(session_id,item_id,guest_id);
CREATE INDEX bills_by_item ON bill_entry(session_id,item_id);
CREATE TABLE allocation_proposal (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL, kind varchar(30) NOT NULL,
    proposed_by uuid NOT NULL, new_owner uuid, status varchar(12) NOT NULL CHECK(status IN('PENDING','ACCEPTED','DECLINED','WITHDRAWN')),
    reason varchar(400) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(restaurant_id,session_id,id), FOREIGN KEY(restaurant_id,session_id) REFERENCES table_session(restaurant_id,id)
);
CREATE TABLE proposal_item (
    restaurant_id uuid NOT NULL, session_id uuid NOT NULL, proposal_id uuid NOT NULL, item_id uuid NOT NULL,
    PRIMARY KEY(proposal_id,item_id), FOREIGN KEY(restaurant_id,session_id,proposal_id) REFERENCES allocation_proposal(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,item_id) REFERENCES order_item(restaurant_id,session_id,id)
);
CREATE TABLE proposed_share (
    restaurant_id uuid NOT NULL, session_id uuid NOT NULL, proposal_id uuid NOT NULL, item_id uuid NOT NULL, guest_id uuid NOT NULL,
    amount_bani bigint NOT NULL CHECK(amount_bani>=0), PRIMARY KEY(proposal_id,item_id,guest_id),
    FOREIGN KEY(proposal_id,item_id) REFERENCES proposal_item(proposal_id,item_id),
    FOREIGN KEY(restaurant_id,session_id,proposal_id) REFERENCES allocation_proposal(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,item_id) REFERENCES order_item(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,guest_id) REFERENCES guest(restaurant_id,session_id,id)
);
CREATE TABLE proposal_vote (
    restaurant_id uuid NOT NULL, session_id uuid NOT NULL, proposal_id uuid NOT NULL, guest_id uuid NOT NULL,
    accepted boolean, PRIMARY KEY(proposal_id,guest_id),
    FOREIGN KEY(restaurant_id,session_id,proposal_id) REFERENCES allocation_proposal(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,guest_id) REFERENCES guest(restaurant_id,session_id,id)
);
-- Phase 4 reserves a quote only. No payment provider or success endpoint exists yet.
CREATE TABLE checkout_reservation (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL, payer_id uuid NOT NULL,
    amount_bani bigint NOT NULL CHECK(amount_bani>0), status varchar(12) NOT NULL CHECK(status IN('HELD','RELEASED','EXPIRED')),
    expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,payer_id) REFERENCES guest(restaurant_id,session_id,id)
);
CREATE TABLE reservation_part (
    restaurant_id uuid NOT NULL, session_id uuid NOT NULL, reservation_id uuid NOT NULL, item_id uuid NOT NULL, guest_id uuid NOT NULL,
    amount_bani bigint NOT NULL CHECK(amount_bani>0), PRIMARY KEY(reservation_id,item_id,guest_id),
    FOREIGN KEY(restaurant_id,session_id,reservation_id) REFERENCES checkout_reservation(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,item_id) REFERENCES order_item(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,guest_id) REFERENCES guest(restaurant_id,session_id,id)
);
-- A phase 5 extension point, never written by a phase 1–4 HTTP endpoint.
CREATE TABLE settlement_entry (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL, item_id uuid NOT NULL, guest_id uuid NOT NULL,
    amount_bani bigint NOT NULL, external_reference varchar(200) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(restaurant_id,session_id,item_id) REFERENCES order_item(restaurant_id,session_id,id),
    FOREIGN KEY(restaurant_id,session_id,guest_id) REFERENCES guest(restaurant_id,session_id,id)
);
CREATE TABLE assistance_request (
    id uuid PRIMARY KEY, restaurant_id uuid NOT NULL, session_id uuid NOT NULL, guest_id uuid NOT NULL,
    reason varchar(200) NOT NULL, status varchar(12) NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','DONE')),
    created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(restaurant_id,session_id,guest_id) REFERENCES guest(restaurant_id,session_id,id)
);
CREATE TABLE audit_event (
    id bigserial PRIMARY KEY, restaurant_id uuid NOT NULL REFERENCES restaurant, session_id uuid,
    actor_id uuid NOT NULL, action varchar(80) NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(restaurant_id,session_id) REFERENCES table_session(restaurant_id,id)
);
CREATE INDEX audit_scope ON audit_event(restaurant_id,session_id,id);
CREATE TABLE command_receipt (
    actor_scope varchar(100) NOT NULL, command_key uuid NOT NULL, fingerprint varchar(64) NOT NULL,
    response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_scope,command_key)
);

CREATE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Accounting and audit entries are append-only' USING ERRCODE='23514'; END $$;
CREATE TRIGGER immutable_bill BEFORE UPDATE OR DELETE ON bill_entry FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER immutable_allocations BEFORE UPDATE OR DELETE ON allocation_entry FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER immutable_settlement BEFORE UPDATE OR DELETE ON settlement_entry FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

CREATE FUNCTION check_item_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bill bigint; allocated bigint; bad boolean;
BEGIN
 SELECT coalesce(sum(amount_bani),0) INTO bill FROM bill_entry WHERE item_id=NEW.item_id;
 SELECT coalesce(sum(amount_bani),0) INTO allocated FROM allocation_entry WHERE item_id=NEW.item_id;
 SELECT EXISTS(SELECT 1 FROM allocation_entry WHERE item_id=NEW.item_id GROUP BY guest_id HAVING sum(amount_bani)<0) INTO bad;
 IF bill<>allocated OR bill<0 OR bill>1000000000 OR bad THEN
   RAISE EXCEPTION 'Item allocations must equal the nonnegative bill exactly' USING ERRCODE='23514';
 END IF;
 IF EXISTS (
   SELECT 1 FROM settlement_entry s WHERE s.item_id=NEW.item_id GROUP BY s.guest_id
   HAVING sum(s.amount_bani)<0 OR sum(s.amount_bani) > coalesce((SELECT sum(a.amount_bani) FROM allocation_entry a WHERE a.item_id=NEW.item_id AND a.guest_id=s.guest_id),0)
 ) THEN RAISE EXCEPTION 'Settlement exceeds its allocation' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER balanced_bill AFTER INSERT ON bill_entry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_item_ledger();
CREATE CONSTRAINT TRIGGER balanced_allocation AFTER INSERT ON allocation_entry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_item_ledger();
CREATE CONSTRAINT TRIGGER bounded_settlement AFTER INSERT ON settlement_entry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_item_ledger();
