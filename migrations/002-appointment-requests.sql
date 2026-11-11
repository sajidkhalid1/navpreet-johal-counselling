CREATE TABLE IF NOT EXISTS appointment_windows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 format text NOT NULL CHECK(format IN ('Phone','Online','In person')), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS appointment_slots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), window_id uuid REFERENCES appointment_windows(id),
 legacy_slot_id uuid UNIQUE, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 format text NOT NULL CHECK(format IN ('Phone','Online','In person')), active boolean NOT NULL DEFAULT true,
 reserved boolean NOT NULL DEFAULT false, CHECK(ends_at=starts_at+interval '1 hour'),
 EXCLUDE USING gist(tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(active)
);
CREATE TABLE IF NOT EXISTS appointment_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slot_id uuid NOT NULL REFERENCES appointment_slots(id),
 name text NOT NULL, email text NOT NULL, phone text NOT NULL DEFAULT '',
 service text NOT NULL CHECK(service IN ('consultation','individual','couples','family')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined','cancelled')),
 connection_details text NOT NULL DEFAULT '', consent_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS appointment_request_active_slot ON appointment_requests(slot_id) WHERE status IN ('pending','approved');
CREATE TABLE IF NOT EXISTS email_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES appointment_requests(id),
 kind text NOT NULL CHECK(kind IN ('confirmation','reminder_day','reminder_hour','cancellation')),
 send_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','scheduled','sent','failed','cancelled','unknown')),
 provider_id text, payload jsonb, attempts integer NOT NULL DEFAULT 0, last_error text,
 locked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(request_id,kind)
);
CREATE INDEX IF NOT EXISTS email_jobs_due ON email_jobs(send_at) WHERE status IN ('queued','failed');
ALTER TABLE email_jobs ADD COLUMN IF NOT EXISTS first_attempt_at timestamptz;
ALTER TABLE email_jobs ADD COLUMN IF NOT EXISTS uncertain boolean NOT NULL DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS sample_key text UNIQUE;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS source_links jsonb NOT NULL DEFAULT '[]'::jsonb;
INSERT INTO appointment_slots(legacy_slot_id,starts_at,ends_at,format)
 SELECT id,starts_at,starts_at+interval '1 hour',format FROM slots WHERE active AND NOT booked AND starts_at>now()
 ON CONFLICT(legacy_slot_id) DO NOTHING;
