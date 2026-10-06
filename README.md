# Weekly Plan

A standalone Next.js App Router application for teachers to submit weekly plans and administrators to review, export and print them for families. The teacher and administrator accounts reuse the existing school's users, class assignments and subject assignments.

## Stack

- Next.js App Router, React and Tailwind CSS
- NextAuth credentials sign-in with role-aware dashboards
- Prisma ORM with PostgreSQL (Supabase)

## Run locally

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `NEXTAUTH_SECRET` and `NEXTAUTH_URL` for the Supabase project.
2. Install packages from this folder with `npm install`. The post-install step generates a Prisma client into this app's `generated` folder.
3. Run `npm run db:push` to add the weekly planner tables to the database. The Prisma schema retains the existing application's models and only adds separate `WeeklyPlannerSubmission` and `WeeklyPlannerItem` tables and their class links.
4. Run `npm run dev` and open `http://localhost:3000`.

Teachers and subjects must already be assigned to users in the shared database. Teachers can submit one plan for several assigned classes at once. Administrators can view an individual class or all classes, filter by week, download a CSV, or use the browser print dialog to print or save the planner as PDF.

Existing credentials support both the current plain-text password values and bcrypt hashes. New accounts should use bcrypt hashes.
