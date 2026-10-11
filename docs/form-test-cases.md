# Kold Creative Studio — form test cases

Scope: Make an enquiry and Book a meeting, including reference-photo attachments and studio review. Meeting submissions are requests awaiting confirmation; no calendar reservation or automated email is expected.

## How to use

1. For automated checks, install dependencies and run `npm run test:forms`. This builds the current source and runs 36 API cases in temporary D1/R2 storage. `npm run test:forms:built` skips rebuilding and must only be used with an up-to-date build. The tests never submit to the hosted site.
2. For browser checks, use a staging/private preview, signed in as its owner. Prefix test names with `QA TEST` and use `qa@example.com`. Requests submitted through the hosted form are real records in that environment. Review them in `/studio` and mark them closed when finished.
3. Use a valid baseline unless a case says otherwise: name `QA TEST Person`, email `qa@example.com`, Photography, message `Please arrange a portrait shoot for this test.`, consent checked. Phone, dates, time and photos are optional for Enquiry. For Meeting, choose a future date and `10:30` Perth time.
4. Test JPG, PNG and WebP; small files, exactly 8 MiB (8,388,608 bytes), and 8 MiB + 1 byte. File limits are per photo; a maximum of three may be attached.
5. Record Actual result, Pass/Fail/Blocked, browser/device, date, and any defect reference. Manual cases below have **not been executed**. API tests do not verify browser rendering or interactions.

## Automated API cases

For rejection cases, no enquiry, upload metadata or stored photo should be added, where explicitly asserted by the suite. IDs below map to the test names in `tests/form.integration.mjs`.

| ID | Scenario / input | Expected result |
| --- | --- | --- |
| F01 | Submit baseline enquiry without optional fields | HTTP 200; generated ID; exact form fields persisted; status `new`; creation timestamp saved. |
| F02 | Submit each of the five package options | Photography, Videography, Reels & posts, Photo + video and Not sure yet accepted and stored correctly. |
| F03 | Meeting with date seven days ahead and time 10:30 | HTTP 200; chosen date/time and Meeting type saved; status `new`, awaiting confirmation. |
| F04 | Enquiry date is today in Australia/Perth | HTTP 200; accepted. |
| F05 | Whitespace around name, email and message | HTTP 200; stored values trimmed. |
| F06 | Name 2/100 characters; message 10/5000 characters; phone 40 characters | Boundary values accepted. |
| F07 | Empty name | HTTP 400; no records added. |
| F08 | One-character name | HTTP 400; no records added. |
| F09 | Name of 101 characters | HTTP 400; no records added. |
| F10 | Email absent | HTTP 400; no records added. |
| F11 | Email `not-an-email` | HTTP 400; no records added. |
| F12 | Email longer than 254 characters | HTTP 400; no records added. |
| F13 | Phone of 41 characters | HTTP 400; no records added. |
| F14 | Whitespace-only message | HTTP 400; no records added. |
| F15 | Message of 9 characters | HTTP 400; no records added. |
| F16 | Message of 5001 characters | HTTP 400; no records added. |
| F17 | Consent absent | HTTP 400; no records added. |
| F18 | Consent value `false` | HTTP 400; no records added. |
| F19 | Unknown package supplied directly to API | HTTP 400; no records added. |
| F20 | Unknown form type supplied directly to API | HTTP 400; no records added. |
| F21 | Meeting with time but no date | HTTP 400; no records added. |
| F22 | Meeting with date but no time | HTTP 400; no records added. |
| F23 | Yesterday in Perth | HTTP 400; no records added. |
| F24 | Impossible date `2099-02-30` | HTTP 400; no records added. |
| F25 | Date in DD/MM/YYYY instead of ISO format | HTTP 400; no records added. |
| F26 | Invalid time `25:00` | HTTP 400; no records added. |
| F27 | Hidden honeypot populated | HTTP 400; no records added. |
| F28 | Three valid photos: JPG, PNG and WebP | HTTP 200; three metadata records linked to enquiry; matching R2 objects, MIME types and sizes. |
| F29 | Four photos | HTTP 400; no enquiry, metadata or photo objects added. |
| F30 | JPEG exactly 8 MiB, then JPEG 8 MiB + 1 byte | Exact limit accepted; oversized photo rejected with HTTP 400 and no additional stored records/objects. |
| F31 | Text file renamed `.png`, with PNG MIME type | HTTP 400; no records/objects added. |
| F32 | JPEG bytes sent with PNG MIME type | HTTP 400; no records/objects added. |
| F33 | POST with another site's Origin | HTTP 403; no records added. |
| F34 | POST with no Origin header | HTTP 403; no records added. |
| F35 | Authorised studio access; view reference photo; change status | Photo accessible with `private, no-store`; PATCH succeeds; status persisted as `contacted`. |
| F36 | Remove preview administration and use unauthorised caller | Inbox GET/PATCH return HTTP 403; private reference photo returns HTTP 404. |

F36 tests application access enforcement in the emulator. It does not validate the hosted platform's sign-in flow or production account allowlist. The preview admin flag is only suitable behind the owner-private Site boundary.

## Manual browser cases

All cases start as **Not run**. Use current Chrome desktop plus Safari on iPhone or Chrome on Android where available. Run layout and visibility checks in both light and dark themes.

| ID | Steps | Expected result | Status |
| --- | --- | --- | --- |
| UI01 | Open form and inspect default state | Enquiry tab active; Not sure yet selected; required fields marked; submit reads Send enquiry. | Not run |
| UI02 | Click Enquire about this from each package card | Page scrolls to form; matching package selected; Enquiry tab active. | Not run |
| UI03 | Use hero meeting button | Meeting tab active; preferred date and time required; submit reads Request a meeting. | Not run |
| UI04 | Submit without filling fields | Browser blocks submission and focuses an invalid required field; no success state. | Not run |
| UI05 | Enter invalid email; submit | Browser rejects email; correct it and submission can proceed. | Not run |
| UI06 | Enter name with one character and message with nine characters; submit | Minimum-length validation blocks submission. | Not run |
| UI07 | Paste more than the field maximum into name/message/phone | Browser enforces name 100, message 5000, phone 40; API cases test bypass attempts separately. | Not run |
| UI08 | Leave phone, date, time and photos blank in Enquiry; submit baseline | Submission succeeds; optional fields do not prevent enquiry. | Not run |
| UI09 | In Meeting, omit date and then omit time | Each omission blocks submission; both required. | Not run |
| UI10 | Try choosing yesterday, then today | Date minimum prevents past dates; today is allowed. Timezone note says Perth. | Not run |
| UI11 | Switch between Meeting and Enquiry with partially completed form | Existing field values retained; date/time become optional on Enquiry and required on Meeting. | Not run |
| UI12 | Select one photo and then three supported photos | Selected names listed; form remains usable; valid photos submit. | Not run |
| UI13 | Select four photos | Error states maximum three; selected files cleared; no submission occurs automatically. | Not run |
| UI14 | Select a photo over 8 MiB | Error shown; file selection cleared; valid selection can be made afterwards. | Not run |
| UI15 | Force-select unsupported or disguised photo; submit | Server rejects invalid file; error displayed; no success state or saved enquiry. | Not run |
| UI16 | Select three photos; remove middle photo using its remove button | Middle filename disappears; only the remaining two are uploaded. | Not run |
| UI17 | Submit with consent unchecked, then checked | Unchecked consent blocks submission; checked consent permits valid form. | Not run |
| UI18 | Slow the request in browser Network tools; click submit repeatedly | Pending button disabled and reads Saving your request; a single ordinary pending submission is sent. This is not server-side deduplication. | Not run |
| UI19 | Submit valid enquiry; inspect success and dashboard | Success says request saved, shows reference matching first eight ID characters; exactly one new dashboard entry contains submitted fields/photos. | Not run |
| UI20 | Submit valid Meeting; inspect success | Success explicitly says meeting awaiting confirmation; no guaranteed booking or email notification claimed. | Not run |
| UI21 | Click Send another enquiry after success | Form available again; personal details/photos cleared; a new request can be submitted. | Not run |
| UI22 | Simulate offline connection or block POST; retry after restoring connection | Error displayed; button re-enabled; entered data retained for retry; success shown only after server acceptance. Verify dashboard before retry if outcome was uncertain. | Not run |
| UI23 | Use keyboard only at desktop and mobile widths, in light/dark themes | Labels and controls readable; focus visible; tabs, selectors, file input, consent and submit reachable; no clipped fields or horizontal page overflow. | Not run |
| UI24 | Enter HTML-like text such as `<script>alert(1)</script>` in message; view studio entry | Content displays as plain text; no script runs. Reference photo links work only for authorised studio access. | Not run |

## Execution record

| Suite | Result | Date / environment | Notes |
| --- | --- | --- | --- |
| API F01–F36 | Passed: 36 cases, 0 failures | 11 Oct 2026; local built Worker with isolated Miniflare D1/R2 | Executed with `node --test tests/form.integration.mjs`. Node reports 37 passing tests including the parent wrapper. |
| Browser UI01–UI24 | Not run | — | Browser automation unavailable in the authoring session. |

## Limits

- API tests validate actual built routes, D1 records and R2 objects, not React interactions.
- UI file labels say MB; the enforced size is 8 MiB. The tests use the exact byte limit.
- Requests are not automatically emailed or placed in a calendar. Dashboard review and manual confirmation are the current workflow.
- Double-click checks cover the pending UI state. The server currently has no idempotency key; separate retries or submissions can create duplicates.
- File validation checks the supported signature and MIME type; it is not a complete image decoder, antivirus scan or malware assessment.
- Database/storage outage simulation, rollback after a forced write failure, end-to-end hosted sign-in, rate limiting and cross-browser results are not covered by this automated suite.
