# +Motive — session handoff (2026-10-26)

## What was built
Direct-contract model (individual owners do NOT publicly list vehicles; Explore is for companies):
- Every user creates a unique chat `@username` on first visiting Chat.
- Chat search by `@username` shows profile picture + ALL accounts the person holds (driver/owner/service provider/company-member). No phone/email/ID exposed.
- Owner wizard: Step 1 model (WORK_AND_PAY or DRIVING_ON; RENT held/disabled) → Step 2 shared private vehicle details (registration, make, model, year, colour, type, fuel, gearbox, mileage; NO licence upload; ONE optional vehicle photo; region = 16-region dropdown; address/area = free text) → Step 3 model-specific owner terms (Work & Pay: total/deposit/installment/frequency/grace/off-days/maintenance; DriveOn: daily sales, frequency, duration, grace, off-days, maintenance/fuel).
- Owner shares a DRAFT contract by the driver's chat username: card lands in the pair's EXISTING chat + in-app notification + email (email excludes the code). Owner sends/resends the 6-digit confirmation code in the same chat. Code generation does NOT depend on Explore approval for direct contracts.
- Driver opens contract from chat (`?contract=<id>` on web; chat card on mobile), sees vehicle photo/colour/region/address + plain-language summary + money fields (`workAndPayTerms`/`drivingOnTerms`), ticks "physically seen vehicle/documents", enters code, confirms. Work & Pay counting starts after grace; schedule re-anchored set-based (172-row contract must not time out). Sign first, burn code only after signing succeeds.

## Key files
- Backend: `apps/backend/prisma/schema.prisma`, migration `20261023190000_chat_username_direct_contract_share` (applied), `src/modules/marketplace/*`, `src/modules/contracts/contracts.service.ts` (`shareContract`, `confirmWithCode`, `acceptContract`), `contracts.controller.ts`, `dto/create-contract.dto.ts`.
- Web: `apps/web/src/lib/api.js`, `src/components/chat/ChatWorkspace.jsx`, `src/app/owner/contracts/page.jsx`, `src/app/driver/contracts/page.jsx` (seen tick keyed per contract id).
- Mobile: `apps/mobile/lib/api.js`, `components/ChatView.jsx`, `app/(owner)/contracts.jsx`, `app/(owner)/messages.jsx`, `app/(driver)/contract.jsx` (seen tick + code reset per contract id — fixed 2026-10-26).

## Verified
- Backend focused tests passed (contracts/marketplace/auth suites), `tsc --noEmit` clean, backend built and running.
- Headless Firefox E2E on exported mobile web bundle: 30/30 checks PASSED (usernames, profile/account search, photo upload, both wizards, share/resend fresh codes, driver display, seen-gate, both Work & Pay and DriveOn confirmed ACTIVE, 61–62 fps). Screenshots: `C:\Windows\System32\shots` (01–09 series).
- Earlier live web Work & Pay contract reached ACTIVE with 172 schedules.

## Runtime (as of handoff; processes are session-managed and may have stopped)
- Backend `node dist/main` → http://localhost:3001/api/v1/health
- Web Next dev → http://localhost:3000
- Mobile exported web bundle served by `C:\Windows\System32\serve-mobile.js` (proxies /api + /uploads to :3001) → http://localhost:8088
- Run your own: `npm run dev` (backend+web) and `npm run dev:mobile` from this repo root. Do NOT run `next build`/`nest build` while dev servers run.

## Cleanup already done
- 72 `browser.*@test.local` verification users, 26 test contracts (+schedules/obligations/codes/threads), 26 test vehicles deleted. 1 real contract remains. DB has 0 orphan contracts.

## Known limits / next possible work
- DriveOn has no PaymentSchedule rows (matches prior Explore flow).
- Mobile verified via exported web bundle in a browser, not a physical device/Expo Go.
- Repo working tree holds a large uncommitted change set — review and commit when ready.
