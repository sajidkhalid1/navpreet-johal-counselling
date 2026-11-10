CREATE TABLE IF NOT EXISTS slots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 format text NOT NULL CHECK (format IN ('Phone','Online','In person')), service text NOT NULL DEFAULT 'consultation' CHECK (service IN ('consultation','individual','couples','family')), active boolean NOT NULL DEFAULT true,
 booked boolean NOT NULL DEFAULT false, CHECK (ends_at>starts_at),
 EXCLUDE USING gist (tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (active)
);
CREATE TABLE IF NOT EXISTS bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slot_id uuid NOT NULL REFERENCES slots(id),
 name text NOT NULL, email text NOT NULL, phone text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS booking_one_confirmed_per_slot ON bookings(slot_id) WHERE status='confirmed';
CREATE TABLE IF NOT EXISTS stories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, category text NOT NULL DEFAULT 'Reflection',
 body text NOT NULL, image text NOT NULL DEFAULT '', published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, window_at timestamptz NOT NULL DEFAULT now(), hits integer NOT NULL DEFAULT 1);
