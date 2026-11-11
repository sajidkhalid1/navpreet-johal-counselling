# Navpreet Johal Counselling

A responsive sage-and-ivory practice website with a calendar, owner-reviewed appointment requests, a journal, and an owner studio at /owner. All appointments last one hour. No payment or clinical notes are collected.

## Run and verify

Requires Node.js 22+. There are no third-party runtime dependencies.

1. Configure .env.local using .env.example. Keep credentials out of Git.
2. Apply schema.sql, then migrations/002-appointment-requests.sql.
3. Generate ADMIN_PASSWORD_HASH with passwordHash() from lib/security.js.
4. Run node scripts/dev.mjs and open http://localhost:3000.
5. Run node scripts/redesign.mjs after editing page compositions. It also runs scripts/refinements.mjs.

For database tests, use an isolated Neon branch and .env.test.local:

    node --env-file=.env.test.local --test

Integration tests use synthetic records and remove them afterward. Email transport tests simulate the provider; they do not send real messages. Booking tests disable email delivery. Production checks:

    node scripts/check-deployment.mjs https://navpreet-johal-counselling.vercel.app

## Pages and artwork

Public routes: /, /about, /services, /booking, /journal, /story?id=..., /contact, /privacy.

Supplied artwork and logos are optimized under public/assets. The edited real portrait is public/assets/navpreet-photo-v1.jpg, with its final editing prompt in public/assets/navpreet-photo-edit.txt. Original supplied artwork is kept in the ignored assets-source directory. Fonts are self-hosted Manrope and DM Serif Display, with licenses under public/assets/fonts.

The homepage uses a botanical canvas, drifting colour washes, parallax, and reversible viewport scaling. Motion can be paused and respects reduced-motion preferences. The counselling overview is a static illustrated sequence with one destination link. Journal illustrations keep their natural aspect ratios.

Shared page generation: scripts/redesign.mjs, scripts/content.json, and scripts/refinements.mjs. Public calendar: public/calendar.js. Journal filters and reading pages: public/journal.js. Owner controls: public/admin.js.

## Calendar and owner approval

The owner publishes a date, an available start/end range, and a meeting format. A range such as 12:00–16:00 produces four one-hour slots. Visitors choose a highlighted date, appointment type, time, and contact details. Requests begin as pending and hold their slot immediately. They are never described as confirmed before approval.

The owner can approve with connection details, decline, or cancel, optionally reopening the slot. The database prevents overlapping availability and concurrent requests for the same slot. The new appointment tables coexist with the original booking tables. Unbooked future legacy slots are migrated as one-hour slots; original records are retained.

All dates use America/Edmonton for Calgary time, including the timezone database’s applicable daylight-saving rules. Availability appears for the next year. Sessions expire after eight hours, use random tokens stored as hashes, and set HttpOnly/SameSite cookies. Public mutations check origin and rate limits. SQL values use bind parameters. Content is escaped before rendering.

## Confirmation and reminder email

The implementation targets the account’s existing Resend integration. Activation needs a verified sending domain and the project’s own Resend key. Set these encrypted production variables in Vercel:

- RESEND_API_KEY
- EMAIL_FROM (a verified sender, optionally Name <address@domain>)
- EMAIL_REPLY_TO (optional)
- EMAIL_DELIVERY_ENABLED=true only after sender verification and an actual delivery check
- CRON_SECRET (a strong random secret protecting /api/reminders)

Until activated, the public request receipt and owner dashboard explicitly say email delivery is being set up. No test sender or fake delivery is presented as working.

Approval commits the appointment and durable email jobs in one database statement. The API then sends a confirmation with an ICS attachment and schedules reminders for 24 hours and one hour before the appointment. Past reminder times are omitted. Emails include scheduling details only, with neutral subjects.

Resend supports scheduling up to 30 days ahead. The daily 09:00 UTC Vercel worker submits queued jobs within the next 29 days and retries known failures. This accommodates Hobby’s daily cron limit while the provider handles exact reminder times. Cancellation removes queued reminders and cancels already scheduled provider messages, including cancellation races during a send. A cancellation notice is queued for an approved appointment.

Jobs are claimed with row locks, persisted payloads, and provider idempotency keys. Uncertain responses are not retried beyond the provider’s 24-hour idempotency window; the owner must review those in Resend. Known quota/authentication failures remain retryable. The dashboard shows queued, scheduled, sent, failed, cancelled, or uncertain status. Sent means accepted/sent by the provider; it is not a guarantee that a recipient read the email. Provider delivery failures should be followed up directly.

No real client email was sent during automated testing. The sender/domain and reminder secret require activation before production email delivery is considered complete.

## Journal

Six original first-person sample reflections are stored in public/starter-stories.json and seeded with:

    node --env-file=.env.local scripts/seed-journal.mjs

Seeding is idempotent and preserves owner edits. Samples are explicitly marked as illustrative editorial reflections, not Navpreet’s personal accounts or individual clinical advice. The owner can edit, unpublish, or replace them and toggle the sample label. Cover uploads support JPEG, PNG, and WebP up to 1.4 MB. Further-reading links are included where relevant.

## Deployment and accounts

GitHub: sajidkhalid1/navpreet-johal-counselling. Vercel project: navpreet-johal-counselling in the user-selected existing team. Production uses the main branch, framework Other, output public, and Node.js 22+.

Required core environment variables: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, APP_ORIGIN. APP_ORIGIN must match the canonical HTTPS origin exactly. Never connect untrusted previews to the production database. Neon project: purple-pond-98018906. Its free plan is quota-limited. The email integration’s free limits also apply. The user selected their existing Vercel Hobby team; Vercel’s published Hobby commercial-use restrictions still apply.

Privacy copy explains scheduling data hosting in the United States and email-provider processing. Confirm practice details, fees, retention, privacy requirements, and public copy with the owner. Rotate the temporary owner password before accepting real clients.

## Sources and references

Practice details: https://www.psychologytoday.com/ca/therapists/navpreet-johal-calgary-ab/942255
General journal reading: https://www.nhs.uk/every-mind-matters/mental-health-issues/stress/ and https://www.nhs.uk/every-mind-matters/lifes-challenges/loneliness/
Motion inspiration only: https://github.com/devis4wd/gsap-moon-parallax-landing and https://github.com/KaranChandekar/creative-agency-landing
Email API: https://resend.com/docs/api-reference/emails/send-email
