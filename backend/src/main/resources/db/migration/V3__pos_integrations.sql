-- One connector account per restaurant in this checkpoint. No live connector is configured.
CREATE TABLE pos_connection (
  restaurant_id uuid PRIMARY KEY REFERENCES restaurant,
  connector varchar(30) NOT NULL CHECK(connector='MOCK'),
  paused boolean NOT NULL DEFAULT false,
  catalog_revision bigint NOT NULL DEFAULT 0, catalog_hash varchar(64),
  last_success_at timestamptz, last_error varchar(400),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pos_mapping (
  restaurant_id uuid NOT NULL REFERENCES pos_connection,
  kind varchar(16) NOT NULL CHECK(kind IN ('TABLE','CATEGORY','PRODUCT','GROUP','OPTION')),
  external_id varchar(160) NOT NULL, local_id uuid NOT NULL, source_hash varchar(64),
  PRIMARY KEY(restaurant_id,kind,external_id), UNIQUE(restaurant_id,kind,local_id)
);
CREATE TABLE pos_session (
  restaurant_id uuid NOT NULL REFERENCES pos_connection,
  session_id uuid PRIMARY KEY,
  last_hash varchar(64), delivered_revision bigint NOT NULL DEFAULT 0,
  external_bill_id varchar(160), last_synced_at timestamptz,
  reconciliation jsonb, reconciled_at timestamptz,
  FOREIGN KEY(restaurant_id,session_id) REFERENCES table_session(restaurant_id,id)
);
CREATE TABLE pos_outbox (
  id uuid PRIMARY KEY, sequence bigserial UNIQUE,
  restaurant_id uuid NOT NULL REFERENCES pos_connection, session_id uuid NOT NULL REFERENCES pos_session,
  revision bigint NOT NULL, payload jsonb NOT NULL, fingerprint varchar(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','IN_FLIGHT','RETRY','FAILED','DELIVERED')),
  attempts int NOT NULL DEFAULT 0 CHECK(attempts>=0), cycle_attempts int NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid, lease_until timestamptz, last_error varchar(400),
  created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz,
  UNIQUE(session_id,revision), FOREIGN KEY(restaurant_id,session_id) REFERENCES table_session(restaurant_id,id)
);
CREATE INDEX pos_outbox_due ON pos_outbox(status,available_at,sequence);
CREATE INDEX pos_outbox_session ON pos_outbox(session_id,sequence);
CREATE FUNCTION protect_pos_message() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'POS messages must be retained'; END IF;
 IF NEW.id<>OLD.id OR NEW.sequence<>OLD.sequence OR NEW.restaurant_id<>OLD.restaurant_id
 OR NEW.session_id<>OLD.session_id OR NEW.revision<>OLD.revision OR NEW.payload<>OLD.payload
 OR NEW.fingerprint<>OLD.fingerprint THEN RAISE EXCEPTION 'POS message identity and payload are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_pos_payload BEFORE UPDATE OR DELETE ON pos_outbox FOR EACH ROW EXECUTE FUNCTION protect_pos_message();

-- Durable simulator state is independent of the outbox acknowledgment transaction.
CREATE TABLE mock_pos_account (
  restaurant_id uuid PRIMARY KEY REFERENCES pos_connection,
  failure_mode varchar(24) NOT NULL DEFAULT 'ONLINE' CHECK(failure_mode IN('ONLINE','OFFLINE','LOSE_REPLY','REJECT')),
  catalog_revision bigint NOT NULL DEFAULT 1, catalog jsonb NOT NULL
);
CREATE TABLE mock_pos_bill (
  restaurant_id uuid NOT NULL REFERENCES mock_pos_account, session_id uuid NOT NULL,
  revision bigint NOT NULL, external_bill_id varchar(160) NOT NULL, payload jsonb NOT NULL,
  kitchen_statuses jsonb NOT NULL DEFAULT '{}', total_offset_bani bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(restaurant_id,session_id)
);
CREATE TABLE mock_pos_receipt (
  restaurant_id uuid NOT NULL REFERENCES mock_pos_account, command_id uuid NOT NULL,
  fingerprint varchar(64) NOT NULL, response jsonb NOT NULL,
  PRIMARY KEY(restaurant_id,command_id)
);
CREATE TABLE mock_pos_kitchen_ticket (
  restaurant_id uuid NOT NULL REFERENCES mock_pos_account, session_id uuid NOT NULL, item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(restaurant_id,item_id)
);
