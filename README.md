# Heart & Hands admissions portal

The public admission form and protected admin portal run from the same Node.js
server. Applications are stored in SQLite locally or PostgreSQL when
`DATABASE_URL` is configured. School notification emails contain only
the student's name and admission number; applicant emails contain a receipt
or the specific rejection reason entered by an administrator.

## Project layout

```text
public/       Public admission form and admin portal assets
src/          Server startup, database, authentication, and application services
scripts/      Administrative setup commands
test/         Automated integration tests
data/         Local SQLite database (created at runtime; not tracked)
```

## Requirements

- Node.js 22.5 or newer (the project uses Node's built-in SQLite module)
- npm
- SMTP account details to enable email notifications

## Setup

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env`. The example is set up for Gmail SMTP:
   `SMTP_USER` must be the Gmail account used as the sender, and `SMTP_PASS`
   must be that account's Google App Password (not its regular password).
   App Passwords require 2-Step Verification. Set `ADMISSIONS_EMAIL_TO` to the
   inbox that should receive school notifications. Keep `.env` private; it is
   excluded from Git.
3. Create the first admin account in an interactive terminal:

   ```sh
   npm run create-admin
   ```

   The password is prompted without echo, must be at least 8 characters, and is
   stored as a scrypt hash. A longer, unique password is recommended. Admin
   accounts are not created from a public registration page.
4. Start the server:

   ```sh
   npm start
   ```

5. Open `http://localhost:3000` for admissions or
   `http://localhost:3000/admin.html` for the admin sign-in.

## Admin portal

Admins can search applications by student name or short admission number,
filter by status, review the complete application, and update its status.
Admission numbers use the format `HH-7K4P2M`: six random characters from an
alphabet that avoids visually ambiguous letters and digits. The server checks
the database for collisions and retries before saving.

Students select Senior 1 or Senior 2; Senior 2 applicants must provide their
previous school's learner identification number (LIN). Age is calculated from
date of birth. Disability/support details and referral source are optional.

SMTP enables the application receipt and rejection email. A rejection requires
a reason; if email is unavailable, the status is saved and the admin portal
shows the delivery state so the administrator can retry. WhatsApp contact is
provided as a link for an administrator to start a conversation; messages are
not sent automatically.

## PostgreSQL and hosting

Without `DATABASE_URL`, the app uses the local SQLite database at
`data/admissions.sqlite`. When `DATABASE_URL` is present, it uses PostgreSQL
and creates or updates the required tables on startup. Store the database URL
as a private environment variable; never commit it.

To copy the existing SQLite applications and admin accounts to an empty
PostgreSQL database, set `DATABASE_URL` in the private `.env` file and run:

```sh
npm run migrate:postgres
```

The migration refuses to write if the target already contains applications or
admins. Admin sessions are not copied, so administrators must sign in again.
Back up both databases before migration.

The app needs a Node.js host and persistent PostgreSQL service; static hosting
alone is insufficient. Vercel or Render hosting will also need platform-specific
configuration. Review free-tier sleep/pausing, limits, backups, and student-data
privacy before deploying real applications. Set Gmail SMTP credentials and
`PUBLIC_BASE_URL` as private host environment variables after deployment.

## Vercel

Vercel can serve the public files and Node.js API, but serverless hosting cannot
retain the local SQLite database. Configure a Supabase PostgreSQL database and
set `DATABASE_URL` to its connection string. Add these private Vercel
environment variables:

- `DATABASE_URL`
- `NODE_ENV=production`
- `TRUST_PROXY=true`
- `PUBLIC_BASE_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`
- `ADMISSIONS_EMAIL_FROM`, `ADMISSIONS_EMAIL_TO`

Before deployment, copy and test the data locally:

```sh
npm run migrate:postgres
```

Import the project into Vercel with the repository root as the project
directory. Vercel uses `vercel.json`, `api/index.js`, and `public/`. The free
tiers and limits can change, so verify current Supabase and Vercel pricing,
sleep behavior, usage limits, backups, and regional data policies before storing
real student applications.

## Tests

Run the focused application, authentication, and search integration tests:

```sh
npm test
```
