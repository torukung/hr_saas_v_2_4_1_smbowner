# Adeptio Adaptive HR — Owner Edition · v2.4.1.smbowner

> **Design-forward demo shell** for Blueprint **v2.4.1.SmbOwner** — a multi-tenant HR platform for the Lao small business, where the owner is also the manager, the HR and the bookkeeper. The persona page lands first; entering a persona opens a clean **Atelier-Pastel** login portal with one **pre-filled frame per persona**, or flip to **Open demo** and walk straight in. Three personas — **Staff · Owner · Platform Administrator** — each with its own accent, navigable menus, and live menu-highlighting. Vanilla JS, no build step, GitHub-Pages-ready.

This pass delivers the **clickable shell**: landing → split auth portal → all three persona workspaces with full, navigable menu trees and representative seeded content (web + mobile). The Lao payroll figures are blueprint-true and reconcile to the kip, but the live compute engine, the live database/Worker, and the LINE/WhatsApp adapters come in later passes.

## Three personas

| Persona | Accent | Shell | Lands on |
|---|---|---|---|
| **Staff** | ochre | single rail · mobile-first PWA | Today |
| **Owner** | plum | **two-tier** (section rail + contextual sub-nav) | Dashboard cockpit |
| **Platform Admin** | teal | single rail · cross-tenant | Overview |

Two personas serve a shop (Staff, Owner); the third — Platform Administrator — runs the whole fleet above them (`tenant_id = null`, inverted data guard: resources & lifecycle only, never sealed salary/PII/KYC content).

## Demo accounts (pre-filled on the portal)

| Persona | Account | Password |
|---|---|---|
| Staff | `staff@phoungern.la` · `staff2@phoungern.la` | `staff123` |
| Owner | `owner@phoungern.la` | `owner123` |
| Owner (2nd tenant) | `owner@vientianemart.la` | `owner123` |
| Manager *(delegated · rides Owner shell, subset)* | `manager@phoungern.la` | `manager123` |
| Platform | `platform@adeptio.la` | `platform123` |

**Front door (`auth_portal` flag):** *Sign-in* (default) raises the wall on persona entry — credentials are pre-filled, one click in. *Open demo* drops the wall everywhere (toggle from the topbar, the landing section, or the launcher meta). The username decides the landing; persona chips double as the scope switcher.

## Multi-tenant

Three seeded tenants — **Phoungern Co.** (active, rich), **Vientiane Mart** (active), **Lao Coffee Lab** (*pending KYC*). The Owner topbar has a **tenant switcher**; the Platform console shows **all tenants** with per-tenant resource meters, a KYC review queue (ID ↔ selfie), allocation, and per-tenant DB ops.

## Owner console — menu depth (two-tier)

Section rail → contextual sub-nav, so each level is one simple list (calm, low-cognitive-load for a non-IT owner):

- **Dashboard** — cockpit (attendance · payroll due · cash · capacity strips · rev-vs-staff-cost)
- **2.1 Staff** — People · Attendance · Scheduling · Leave · Messaging · Access
- **Payroll** — Pay runs · Components · Advances (EWA) · Statutory · Payslips · Leveling (L0–L3)
- **2.2 Books** — Cashbook · Monthly close · Tax centre · Cost & benefit · Reports
- **2.3 System** — Company · Functions (flags) · Integrations · Users · Data studio · Audit
- **2.4 Capacity** — Plan · Seats · Message quotas · Storage · Billing

## What's representative vs. later

- **Built & true now:** all navigation, both menu levels with active highlight, per-persona color, tenant switching, the split portal + demo toggle, mobile PWA frames, and the Lao payroll worked example (base ₭6,000,000 → net **5,492,250**, employer cost **6,270,000**) — verified by the smoke test.
- **Later passes:** live payroll/accounting compute engine (BO-4…BO-8), live DB + Cloudflare Worker (flip from the S0 mock), **LINE & WhatsApp** adapters (accounts under registration — shown as *pending* with wiring ready), and the **ລາວ** language pack (portal & payslips already bilingual; full UI pack staged in `i18n.js`).

## Run it

Open `index.html` in any modern browser — no build, no dependencies, no backend. (For a single portable file, `preview-smbowner.html`.) Deploy later by pushing the folder to a GitHub repo with Pages enabled — it's already static and path-relative.

## Structure

```
index.html
css/  tokens.css (Atelier Pastel · 3-persona accents)  ·  app.css (carried v2.4.0 + Owner-Edition extensions)
js/   i18n.js · ui.js · data.js · auth.js · personas.js · app.js
js/screens/  staff.js · owner.js · platform.js · authviews.js
tools/  smoke.js (node — 154 checks)  ·  make-preview.js (single-file bundler)
```

## Tools

```
node tools/smoke.js          # personas, payroll reconcile, every screen renders
node tools/make-preview.js   # → preview-smbowner.html (one portable file)
```

Design tokens identical to the series (**Atelier Pastel — no drift**). Statutory figures current to June 2026; not legal/tax advice. Demo data only.
