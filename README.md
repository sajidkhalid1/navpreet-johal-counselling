# Navpreet Johal Counselling

A sage-and-cream counselling website with original SVG/CSS placeholder illustrations, responsive layouts, reduced-motion support, consultation booking, and an owner studio at `/owner`.

## Run

Requires Node.js 22+. There are no third-party runtime dependencies.

1. Copy `.env.example` to `.env.local` and set the values.
2. Apply `schema.sql` to an empty Neon Postgres database.
3. Generate a salted password hash using `passwordHash()` from `lib/security.js`; store it only in `ADMIN_PASSWORD_HASH`.
4. Run `node scripts/dev.mjs` and open `http://localhost:3000`.

Run `node --test` for security tests. Run `node --env-file=.env.local --test` for the database integration test. It uses isolated synthetic records and removes them afterward. Do not run tests concurrently against the same database.

## Vercel

Import this repository with framework preset **Other**, output directory `public`, no build command, and Node.js 22+. `api/index.js` is the serverless API; `vercel.json` maps API paths and `/owner`.

Configure encrypted environment variables: `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `APP_ORIGIN` (the exact canonical HTTPS site origin, without a trailing slash). Set these separately for preview environments using an isolated database. Production booking data must not be shared with untrusted previews.

## Owner studio

- Publish dated, 15-minute consultation slots around other commitments. Date/time entry uses `America/Edmonton`, with database timezone conversion.
- See bookings and contact information. Cancel appointments after contacting the client directly.
- Write, edit, draft, publish, and unpublish journal stories with JPEG/PNG/WebP cover pictures up to 1.4 MB.

Slot overlap is prevented by a Postgres exclusion constraint. Reserving a slot and creating a booking happen in one atomic SQL statement. Sessions are random, server-stored hashes with an eight-hour expiry and HttpOnly/SameSite cookies. Login and booking endpoints have database-backed rate limits and origin checks. All SQL uses bind parameters. Story text is escaped when rendered.

## Operational details

- Booking confirmations are displayed immediately with an `.ics` calendar download. **No email or SMS is sent.** The owner should contact the client to arrange call, online, or location details.
- No payments or clinical notes are collected.
- Initial availability is empty on purpose: publish real slots before accepting bookings.
- Sample journal entries are explicitly labelled and disappear once a real story is published.
- Public phone, qualifications, and service categories were checked against the supplied Psychology Today profile on 2026-11-10. Confirm practice copy and current details with Navpreet before public launch. LinkedIn and CalgaryDoctors could not be fetched.
- Privacy notice states that scheduling data is hosted in the United States. Review the notice, data handling, retention, and professional requirements with the owner before accepting real client data.
- Rotate the temporary owner password before public launch. To change it, generate a new hash, update the encrypted Vercel variable, clear `sessions`, and redeploy.
- Neon project: `purple-pond-98018906` (free-plan organization). Free usage is quota-limited, not a guarantee of unlimited free hosting. Images use database space; monitor storage.
- Vercel Hobby is for personal, non-commercial use. A commercial practice requires a suitable Vercel plan.

## Content sources

- https://www.psychologytoday.com/ca/therapists/navpreet-johal-calgary-ab/942255
- Layout inspiration only: genlift.ca, thehealinghive.ca, thetherapeuticway.ca. No copied photographs, branding, testimonials, or article content.
