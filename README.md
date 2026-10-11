# Kold Creative Studio

A responsive editorial portfolio and booking/enquiry website, inspired by the supplied visual references. Built with React, TypeScript and Vinext for Cloudflare Workers, D1 and R2.

## Included
- Filterable portfolio and accessible project detail dialog.
- Photography ($300, 2–4 hour shoot, 20–30 edited photos), videography ($550, 2 edited videos), reels & posts ($400, 5 reels, 10 posts), photo + video ($850, 1 edited video, 20 edited photos).
- Meeting requests and enquiries saved durably in D1. Meeting dates are requests requiring manual confirmation, not guaranteed availability.
- Up to 3 private reference photo attachments per enquiry, 8 MB each, stored in R2.
- `/studio` dashboard: upload portfolio covers, review enquiries and reference photos, update statuses, remove projects.
- Real portfolio uploads automatically replace sample gallery cards.

## Development
Use Node 22.13+ and `npm run install:ci` (or pnpm install using the tracked lockfile). Run `npm run db:generate` after schema changes and `npm run build`. Apply the generated SQL migrations to a local D1 database before testing forms. See the starter scripts for local runtime setup. `npm run dev` runs the local app.

Hosting bindings in `.openai/hosting.json`: `DB` (D1), `BUCKET` (R2). Cloudflare/Sites authentication supplies trusted identity headers.

## Before public launch
The initial hosted Site is OWNER-PRIVATE, for review. Its dashboard is protected by that platform boundary with `PRIVATE_PREVIEW_ADMIN=true`. **Before changing the audience to public, remove PRIVATE_PREVIEW_ADMIN, configure ADMIN_EMAIL to the studio owner's ChatGPT sign-in email, and verify dashboard access with authorised and unauthorised accounts.** Without either setting, administrative writes are denied. Do not host this build outside that access boundary with preview administration enabled. For external hosting, replace platform identity integration with a trusted authentication provider.

Add the client's actual photos, films and business details. Sample photos are Unsplash imagery, explicitly labelled in the preview; they are not client projects. Replace the hero images as well as uploading portfolio work. No client testimonials or past-project claims are invented.

Enquiries are stored in the dashboard; automatic email notifications, calendar availability/scheduling, payments and outgoing confirmation emails are not configured. Dashboard status changes do not send email. Use the email link to respond manually. Configure an email provider before relying on notifications, and anti-spam/rate-limit protection before public launch. Confirm currency, tax treatment, privacy/retention terms and business contact details with the client.

The supplied domain `koldcreativestudio.com` is not attached automatically. DNS ownership and hosting configuration are required before attaching it; the preview uses a separate URL.

## Sample imagery
Downloaded from images.unsplash.com: photo-1534528741775-53994a69daeb (portrait), photo-1518837695005-2083093ee35b (coast), photo-1483985988355-763728e1935b (fashion), photo-1524504388940-b1c1722653e1 (studio). Served locally to avoid runtime third-party requests.
