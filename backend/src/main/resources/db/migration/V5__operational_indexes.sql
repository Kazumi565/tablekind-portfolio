-- Read-only operational checks must not scan settled payment history on each refresh.
CREATE INDEX pending_payment_age ON payment_attempt(restaurant_id,created_at) WHERE status='PENDING';
CREATE INDEX pending_refund_age ON payment_refund(restaurant_id,created_at) WHERE status='PENDING';
CREATE INDEX undelivered_pos_age ON pos_outbox(restaurant_id,created_at) WHERE status<>'DELIVERED';
