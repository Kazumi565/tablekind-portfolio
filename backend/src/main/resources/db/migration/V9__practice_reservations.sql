-- This table does not reserve actual dining-table capacity or contact a guest.
CREATE TABLE practice_reservation (
    id uuid PRIMARY KEY,
    restaurant_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    session_id uuid NOT NULL,
    guest_id uuid NOT NULL,
    requested_for timestamptz NOT NULL,
    party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 20),
    status varchar(20) NOT NULL DEFAULT 'REQUESTED'
      CHECK (status IN ('REQUESTED','PRACTICE_APPROVED','DECLINED','CANCELLED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    FOREIGN KEY (restaurant_id, branch_id) REFERENCES branch(restaurant_id, id),
    FOREIGN KEY (restaurant_id, session_id, guest_id) REFERENCES guest(restaurant_id, session_id, id)
);
CREATE INDEX practice_reservation_queue ON practice_reservation(restaurant_id, status, requested_for);
CREATE INDEX practice_reservation_guest ON practice_reservation(guest_id, created_at DESC);
