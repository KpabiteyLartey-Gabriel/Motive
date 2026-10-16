# +Motive — Product Requirements

> **+Motive (Positive Motive)** — an investment-promotion and job-creation platform for Ghana's commercial transport sector: transparent, accountable and auditable agreements between everyone who keeps a vehicle earning.

| Item | Detail |
|---|---|
| Product | +Motive (working brand in app: GH Motive) |
| Platforms | Web (Next.js) and mobile (Expo), one shared backend/API |
| Market | Ghana — commercial transport (trotro, taxi, ride-hailing, logistics, company fleets) |
| Status | Living document — update this file whenever scope is agreed in brainstorming |

---

## 1. What this is, why it came up, and why it is needed

### 1.1 The problem

Ghana's commercial transport runs largely on informal arrangements:

- A driver who wants to work — full-time, part-time, or as a side hustle — has no trusted way to find a vehicle, and an owner with a parked car has no trusted way to find that driver.
- "Work and pay", rental and drive-on deals are verbal. When a payment is missed or a vehicle is damaged, neither side can prove what was agreed.
- Owners who hand over a car lose sight of it: no payment record, no location, no service history.
- Companies that operate vehicles they do not own (owner-supplied cars in a fleet) manage drivers, owners, repairs and paperwork in chats and notebooks.
- Maintenance is reactive: a breakdown is a phone call, with no location shared, no job record, and no agreed price.
- Contracts are witnessed informally, if at all; copies are lost, and disputes have no evidence to refer to.
- Driving licences, insurance, roadworthiness and registration expire unnoticed, putting drivers and owners at legal risk.

### 1.2 What +Motive is

+Motive brings **six participant types onto one connected platform** (web + mobile) where every agreement is written, every payment is recorded, every vehicle is visible, and every action leaves an audit trail:

1. **Drivers**
2. **Vehicle Owners**
3. **Transport Companies**
4. **Fleet Managers** (staff of a company)
5. **Maintenance Providers**
6. **Legal Professionals**

On top of those participants, +Motive is:

- **An investment-promotion system** — it turns a parked private car into an income-producing asset, and lets owners place cars with companies that operate them for a managed return.
- **A job-creation platform** — licensed drivers without capital can get a vehicle (work-and-pay, drive-on, company rental, or company employment) and earn, with a recorded path to owning the vehicle.
- **A trust layer for transport agreements** — digital contracts, witnessed signing, MoMo payment collection, a double-entry style ledger, live tracking and remote vehicle control, document-expiry monitoring, and a complete audit trail.

### 1.3 Why now / why it is needed

- Mobile Money (MTN MoMo) is already how Ghana moves money; collections can be automated and receipted.
- Cheap GPS trackers make live location, speed monitoring and remote engine control practical for ordinary owners, not just large fleets.
- The informal system wastes assets (parked cars), blocks credit (no records), and creates disputes. A shared record is the missing infrastructure.

### 1.4 Goals

| # | Goal |
|---|---|
| G1 | Any licensed driver can find earning work with a vehicle, without needing purchase capital. |
| G2 | Any owner can put a vehicle to work and see every cedi, kilometre and service event. |
| G3 | Companies can run mixed fleets (own + owner-supplied vehicles) with staff roles and full controls. |
| G4 | Every contract is drafted, witnessed, signed and stored so all parties hold the same copy. |
| G5 | Every payment is collected, receipted, split correctly and auditable end-to-end. |
| G6 | Licences, insurance, roadworthiness and registration never expire silently. |
| G7 | Maintenance and legal help can be summoned to a vehicle's live location, paid per service or by subscription. |

### 1.5 Non-goals (for now)

- +Motive does not itself own vehicles, employ drivers, or provide legal advice; it is the platform and record.
- Ownership transfer is a guided, verified workflow — never an automatic event on final payment.
- Exact commission percentages and subscription prices are commercial decisions still to be set (see §10 Open questions).

---

## 2. Operating models (how a vehicle earns)

| Model | Who offers it | How it works | End state |
|---|---|---|---|
| **Work & Pay** | Owners, companies | Driver pays scheduled instalments (MoMo) toward an agreed vehicle price; balance, receipts and deadlines tracked live. | On completion, a separate verified ownership-transfer workflow begins. |
| **DriveOn (Driving On)** | Owners, companies | Driver operates the vehicle and pays an agreed daily/weekly sales amount; keeps the rest after agreed deductions (fuel, expenses, owner/company fees); daily reconciliation. | Vehicle stays with the owner/company. |
| **Rental** | **Companies only** | A company rents a vehicle to a client/driver on agreed terms; salary or revenue-share variants are defined in the contract. | Vehicle returns at term end. |
| **Company employment** | Companies | A permanent staff driver is assigned a company (or owner-supplied) vehicle under an employment-linked assignment. | Assignment ends by company action. |
| **Fleet placement (owner → company)** | Owners via companies | An owner adds a car to a company's fleet; the fleet manager lists and operates it (DriveOn, Work & Pay, or company Rental) and the owner earns while the company earns a management share. | Owner can view everything and exit per contract terms. |

Every model runs on the same rails: a digital contract (§6), MoMo collections and splits (§8), tracking and remote control (§9), and paperwork monitoring (§9).

---

## 3. Participant: Drivers

**Who they are.** Licensed drivers in any of these situations:

- Off from main work today and wanting a car to drive for income or a side hustle.
- Full-time drivers who want to own a car but lack purchase capital → Work & Pay or DriveOn.
- Drivers available to drive a rented car for a company's client.
- Permanent staff drivers of a transport company.

**Requirements**

| # | Requirement |
|---|---|
| D1 | Sign up with a **valid driving licence** (number, class, expiry, photo/scan). No valid licence → no activation as a driver. |
| D2 | Licence expiry is monitored; the driver is notified before expiry and on expiry, and driving availability is suspended if the licence lapses until renewed. |
| D3 | **Availability toggle**: a driver can mark themselves available/unavailable for DriveOn, rental driving, or company work. |
| D4 | Browse/apply for available vehicles and offers (Work & Pay, DriveOn, company rental, company jobs). |
| D5 | Review full contract terms before signing; sign digitally (with legal witnessing where required, §6). |
| D6 | Pay instalments/sales by MTN MoMo; every payment receipted; live balance, paid/remaining, next due date always visible. |
| D7 | Log daily earnings and expenses (DriveOn reconciliation). |
| D8 | See assigned vehicle(s), documents status, maintenance history and upcoming service. |
| D9 | **Raise help**: report a breakdown/incident to the owner/company/fleet manager and maintenance provider, sharing live location, with a voice or video recording as evidence. |
| D10 | Raise and follow disputes with evidence on a recorded timeline. |
| D11 | Build a portable record: payment reliability, completed contracts, ratings — usable as proof for the next opportunity. |

---

## 4. Participant: Vehicle Owners

**Who they are.** Individuals (often with a full-time job elsewhere) who own one or more cars.

**Requirements**

| # | Requirement |
|---|---|
| O1 | Register vehicles with photos, registration and documents; documents are monitored for expiry (§9). |
| O2 | List a vehicle as available for **DriveOn** or **Work & Pay** and receive profit without driving it. |
| O3 | For a car already out on Work & Pay: receive and monitor MoMo payments, balance and arrears in real time. |
| O4 | **Track the vehicle live**, review trips and speed, and use remote controls — remote lock and engine off/on — through the connected tracker (§9). |
| O5 | **Place a car with a company**: hand the vehicle to a company's fleet manager to list and operate (DriveOn, Work & Pay, or company Rental); owner sees all activity and earnings; company earns its management share (§7). |
| O6 | Engage a **maintenance company** per service or by subscription — e.g. detailing, minor fixes (broken side mirror, torn seat leather patch), air fresheners, regular washing — with jobs recorded against the vehicle. |
| O7 | Invite a **legal professional** to witness/facilitate any deal: joint pre-recorded video or in-platform voice/video call; owner pays per service (§6). |
| O8 | Receive alerts: payment received/missed, document expiring, speeding, maintenance due, vehicle moved. |
| O9 | Full history per vehicle: contracts, payments, maintenance, documents, incidents — exportable for records/tax. |

---

## 5. Participants: Transport Companies and Fleet Managers

### 5.1 Transport Companies

**Who they are.** Businesses that join +Motive to make money operating vehicles — some their own, many supplied by individual owners (O5).

**Requirements**

| # | Requirement |
|---|---|
| C1 | Company account with an admin who manages members, roles and access (company admin is the control point). |
| C2 | **Invite-based onboarding**: the admin invites people by email or phone and selects the role (fleet manager, legal, member, driver). The invitee does not need a pre-existing account and does not choose "transport company"; opening the link runs onboarding that creates the account already tied to that company and role, then lands them in the right portal. |
| C3 | Accept and onboard drivers; put them on **Work & Pay**, **DriveOn**, **company Rental**, or **permanent staff** assignments. |
| C4 | Manage **vehicle owners as clients**: company vehicles and owner-supplied vehicles are distinguished, and each owner's earnings and statements are kept separate. |
| C5 | Engage maintenance providers and legal professionals for the fleet (per service or subscription) and invite them the same way as staff. |
| C6 | Full tracking and remote-control suite for every operated vehicle (§9), including sharing a live location with a maintenance provider attending a breakdown. |
| C7 | Collections and splits handled automatically (§8): driver payment → owner share, company management share, platform fee — each visible to whoever earned it. |
| C8 | Reports: revenue, expenses, utilisation, arrears and profitability per vehicle, per driver and per owner. |
| C9 | Company admin can do everything a fleet manager can do; admins manage who has access and can deactivate members (the last active company admin cannot be removed). |

### 5.2 Fleet Managers

**Who they are.** Staff of a company (invited under C2) who run the day-to-day fleet. They manage cars the company operates — company-owned and owner-supplied alike.

**Requirements**

| # | Requirement |
|---|---|
| F1 | Scoped portal: vehicles, photos and documents, driver assignments, contracts, maintenance, tracking, devices and alerts for their company's fleet only. |
| F2 | List vehicles for DriveOn / Work & Pay / Rental (per company permissions), assign drivers, and keep vehicle paperwork current (§9). |
| F3 | **Tracking and remote control**: live locations, trips, speeding alerts, engine off/on and lock commands with an auditable command lifecycle (queued → sent → acknowledged). |
| F4 | **Trigger emergency help**: raise or receive a driver incident (with the driver's voice/video recording and live location) and dispatch a maintenance provider to that location. |
| F5 | Settings and account self-service: profile, profile photo, password change, and account status. |

---

## 6. Legal Professionals and witnessed contracting

**Who they are.** Lawyers/legal professionals engaged by owners, drivers or companies — per service, or retained by a company.

**Requirements**

| # | Requirement |
|---|---|
| L1 | Invited by an owner/company (C2-style invite) or engaged per deal; no separate "register as a company" confusion. |
| L2 | **Witness a contract** on an in-platform voice or video call, or via a joint pre-recorded video attached to the contract. |
| L3 | Facilitate/draft contract terms for Work & Pay, DriveOn, Rental, fleet-placement and employment deals. |
| L4 | **Sign digitally**, or sign and upload the signed document; all parties sign/upload in the same place. |
| L5 | Every party — driver, owner, company, legal — keeps an identical copy retrievable at any time, with the signing/witnessing evidence attached. |
| L6 | Legal portal: monitor and manage contracts per vehicle, insurance, roadworthiness, registration and all vehicle paperwork (§9), plus cases/disputes. |
| L7 | Paid per service (per witnessing/signing) unless retained by a company; fees are quoted, agreed and recorded before the session. |

---

## 7. Maintenance Providers

**Who they are.** Garages, service centres, mobile mechanics, detailers and wash providers. There are different kinds of provider; the platform lists them and owners/companies promote preferred ones as *their* providers.

**Requirements**

| # | Requirement |
|---|---|
| M1 | List on the platform with services, coverage area, and pricing model: **pay-per-service** and/or **subscription** (e.g. scheduled washing, detailing, minor fixes, periodic checks). |
| M2 | Owners and companies can attach a provider to a vehicle/fleet as their provider of record (per service or on subscription). |
| M3 | Receive job requests with the **vehicle's live location**; attend, diagnose, quote, fix, and record parts/labour against the vehicle's permanent history. |
| M4 | Emergency dispatch: accept a breakdown raised by a driver/fleet manager (F4/D9) with location sharing and the driver's voice/video report. |
| M5 | Invoice through the platform; payment per completed job or per subscription period (§8 payments), with ratings after each job. |
| M6 | Subscriptions must define exactly what is included (services, frequency, response time) so delivery is checkable. |

---

## 8. Payments, collections and transactions *(added — this was missing)*

All money movement follows one rule: **the platform records first, and every balance can be explained from the ledger.**

| # | Requirement |
|---|---|
| P1 | **Collections**: drivers pay instalments/sales by MTN MoMo (other rails may be added); every collection creates a receipt and a ledger entry; duplicate provider webhooks never double-post (idempotency). |
| P2 | **Automatic splits**: on each collection the ledger splits the amount per the contract — driver payment → vehicle owner share, company management share (for fleet-placed cars), platform fee, and any agreed deductions. Rates are contract fields, set at signing, visible to all parties. (Percentages: TBD, §10.) |
| P3 | **Payouts**: owners, companies, maintenance providers (per job/subscription) and legal professionals (per service) are paid out to their MoMo/bank on the agreed cycle; every payout references the collections it came from. |
| P4 | **Wallets/statements**: each participant sees a statement of money in, splits, fees and payouts — the same numbers on web and mobile, always confirmed by the backend, never estimated on the device. |
| P5 | **Arrears & automation**: missed payments flag automatically, notify driver + owner/company, and feed the driver's reliability record (D11); late-fee rules, if any, are contract terms shown before signing. |
| P6 | **Service payments**: maintenance jobs and legal services are quoted → approved → paid through the platform (or marked paid-in-cash with both sides confirming), so the job record and the money record match. |
| P7 | **Subscriptions**: recurring MoMo collection for maintenance subscriptions and any platform plans, with pause/cancel and a delivery log (M6). |
| P8 | **Refunds/disputes**: disputed amounts are held against the contract record and resolved through the dispute timeline (L6); refunds post as reversing ledger entries — history is never edited silently. |

---

## 9. Tracking, remote control, documents and notifications *(cross-cutting)*

| # | Requirement |
|---|---|
| T1 | GPS tracker per vehicle: live location, trip history, speed monitoring and speeding alerts to owner/company/fleet manager. |
| T2 | Remote commands — **engine off/on, lock/unlock** — queued to the device with status (pending → sent → acknowledged) and a full audit log of who commanded what, when, and why. Engine-off is blocked while the vehicle is moving above a safe speed threshold. |
| T3 | Safe shareable live-location link (time-limited) for clients, family or an attending maintenance provider. |
| T4 | **Document monitoring** for every vehicle: insurance, roadworthiness, registration and any required paperwork, plus driver licences (D2) — alerts at agreed intervals before expiry, on expiry escalation to owner/company/legal. |
| T5 | Emergency/incident flow ties it together: driver raises (voice/video + location) → owner/fleet manager sees it → maintenance dispatched to the location → job and outcome recorded. |
| T6 | Notifications by push/SMS/email for: payments, arrears, expiries, speeding, incidents, contract actions, invite and signing requests. |
| T7 | **Audit trail**: contracts, signatures, payments, commands, document changes and role/access changes are append-only and attributable to a user. |
| T8 | Roles and access: company membership is the source of company access; participants only ever see vehicles, money and people inside their scope. |

---

## 10. Open questions / improvements to decide

| # | Question |
|---|---|
| Q1 | Platform fee and default split percentages per model (Work & Pay / DriveOn / Rental / fleet placement)? |
| Q2 | Is the public brand **+Motive** everywhere (replacing GH Motive), with GH Motive kept as the legal/company name? |
| Q3 | Tracker hardware: which device(s) are certified first, and who pays for/installs them — owner, company, or platform bundle? |
| Q4 | Legal witnessing: is a recorded in-platform call required for all contracts above a value threshold, and optional below it? |
| Q5 | Maintenance subscription catalogue: standard packages (wash/detail/minor-fix bundles) vs provider-defined only? |
| Q6 | Driver marketplace: can any available driver (D3) be matched to any listed vehicle, and who approves — owner, company, or both? |
| Q7 | Credit/reliability score: how is D11 scored and shared, and can drivers dispute it? |
| Q8 | Payout cycle (instant, daily, weekly) and minimum payout threshold per participant type? |
| Q9 | Insurance: partner insurer on-platform for instant renewal, or record-only monitoring (T4) first? |
| Q10 | Which of §§3–9 is MVP, and what is explicitly phase 2? (Suggested MVP: D1–D6, O1–O5, C1–C7, F1–F3, L2–L5, M1–M3, P1–P5, T1–T4.) |

---

## 11. Pitch summary (one paragraph)

+Motive turns Ghana's parked cars into jobs and income — safely. A licensed driver with no capital gets a vehicle on Work & Pay, DriveOn, or a company rental and builds a recorded path to ownership. An owner whose car sits at home lists it, watches every MoMo payment and every trip, and can lock or switch off the engine from their phone — or hand the car to a transport company whose fleet managers run it while the owner watches the same numbers. Maintenance providers and legal professionals plug into the same record: help is dispatched to a live location, contracts are witnessed on a recorded call and signed digitally, and every cedi is split, receipted and auditable. Six participants, one platform, zero verbal agreements.

