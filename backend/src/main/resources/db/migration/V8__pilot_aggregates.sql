-- Aggregate counts only. No guest, device, IP, path, email or token is retained here.
CREATE TABLE pilot_daily_count (
    restaurant_id uuid NOT NULL REFERENCES restaurant(id),
    day date NOT NULL,
    event varchar(32) NOT NULL CHECK (event IN
      ('QR_SCAN','TABLE_JOIN','ORDER_SUBMITTED','SHARE_ACCEPTED','SHARE_REJECTED',
       'PAYMENT_COMPLETED','COORDINATION_COMPLETED','FLOW_ERROR')),
    count bigint NOT NULL CHECK (count >= 0),
    PRIMARY KEY (restaurant_id, day, event)
);

CREATE FUNCTION count_pilot_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE metric varchar(32);
BEGIN
    metric := CASE NEW.action
      WHEN 'GUEST_JOINED' THEN 'TABLE_JOIN'
      WHEN 'ORDER_SUBMITTED' THEN 'ORDER_SUBMITTED'
      WHEN 'SHARE_APPROVED' THEN 'SHARE_ACCEPTED'
      WHEN 'SHARE_DECLINED' THEN 'SHARE_REJECTED'
      WHEN 'PAYMENT_SUCCEEDED' THEN 'PAYMENT_COMPLETED'
      WHEN 'SESSION_CLOSED' THEN 'COORDINATION_COMPLETED'
      ELSE NULL END;
    -- An empty table can close with no bill; it is not a completed payment flow.
    IF metric = 'COORDINATION_COMPLETED' AND NOT EXISTS (
      SELECT 1 FROM bill_entry WHERE session_id=NEW.session_id AND amount_bani>0
    ) THEN RETURN NEW; END IF;
    IF metric IS NOT NULL THEN
      INSERT INTO pilot_daily_count(restaurant_id, day, event, count)
      VALUES (NEW.restaurant_id, (NEW.created_at AT TIME ZONE 'UTC')::date, metric, 1)
      ON CONFLICT (restaurant_id, day, event)
      DO UPDATE SET count = pilot_daily_count.count + 1;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER pilot_from_audit AFTER INSERT ON audit_event
FOR EACH ROW EXECUTE FUNCTION count_pilot_audit();
