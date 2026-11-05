# DESIGN.md — Audited UI/UX Architecture & Design System Specification

**Project:** Katalis AI Gateway (Unified OpenAI-Compatible AI API Aggregator)  
**Document Version:** 4.0 (Principal Audit Edition — Implementation-Ready Single Source of Truth)  
**Scope:** Visual Design System, Component Specifications, Information Architecture, UX Flows, and Accessibility  
**Business Logic & Backend Reference:** All business rules, database schemas, payment webhook mechanics, and upstream routing algorithms are governed by `PRD.md` and `CLAUDE.md`.

## 1. Executive Design Direction & Requirement Audit

Katalis AI Gateway is a developer infrastructure platform that provides unified, OpenAI-compatible API access (`/v1/chat/completions`, `/v1/models`) to multiple upstream AI providers with transparent per-token pricing and local payment integration.

### 1.1 Visual Identity: "Warm Editorial Precision"
The interface is designed as a serious engineering instrument—combining the high-density, keyboard-first ergonomics of **Linear**, **Vercel**, and **OpenRouter** with a tactile **Warm Editorial** surface palette (`#F0EEE8` archival paper canvas, `#FAF9F5` elevated surface, `#282824` charcoal ink, and `#B77A45` terracotta ochre accent).

* **High Density Without Clutter:** Information is organized using `1px solid` hairline borders (`#DCD8CE` light / `#2A2925` dark), compact `38px–44px` single-line table rows, and aligned tabular monospace numerals (`JetBrains Mono`) rather than oversized marketing cards or heavy drop shadows.
* **Separation of UI Presentation from Business Rules:** Components are strictly data-driven. Model catalogs, token prices, pool labels, and billing options are rendered dynamically from backend API responses (`GET /v1/models`, `GET /api/billing/plans`) rather than hardcoded into frontend templates.

### 1.2 Audit of Product Requirements & Assumptions
To prevent frontend over-engineering or hardcoded assumptions, every product capability referenced in this design specification is classified into one of three verification tiers:

| Classification Tier | Definition | Audited Capabilities & Design Implications |
| :--- | :--- | :--- |
| **1. CONFIRMED**<br>*(Explicitly mandated by user or core project scope)* | Core requirements verified by user decisions and `PRD.md` baseline scope. Must be built for MVP launch. | • **Unified OpenAI-Compatible API Gateway** (`/v1/chat/completions`, `/v1/models`)<br>• **Member Account System (Decision 1.B):** Email/Password & OAuth login with multi-API key creation and management per account<br>• **Core 8-Token Warm Palette:** `#F0EEE8`, `#FAF9F5`, `#282824`, `#B77A45`, `#77746B`, `#DCD8CE`, `#54836A`, `#C45E52`<br>• **Prepaid Wallet Balance & Self-Serve Top-Up Flow** (with dynamic QRIS invoice display)<br>• **Focus on Cost-Efficient Chinese & Global LLMs** (rendered dynamically from catalog API)<br>• **Usage Tracking & Request Debugging** for developers and coding agents |
| **2. PROPOSED**<br>*(Suggested in `PRD.md` or prototype; subject to business configuration)* | Optional product mechanics that may change before or after launch. UI must treat these as **config-driven optional modules**, never hardcoded constants. | • **Brand Name (`Katalis`):** Injected via environment config (`VITE_APP_NAME`), not hardcoded across views<br>• **Subscription Passes (`Unlimited 10-Day`, `1-Day Trial`), Daily Bonus Quotas, & Pool Discounts (`-30% LoRA`):** Rendered conditionally only when enabled by `/api/billing/plans`<br>• **Pool Tier Classifications (`Dedicated LoRA`, `Stable`, `Flex`):** Rendered as dynamic string badges from `model.tier` metadata<br>• **Specific QRIS Nominal Presets & Upstream Model Prices:** Fetched from backend configuration endpoints<br>• **Anthropic `/v1/messages` Native Endpoint Compatibility:** Displayed as a capability badge per model only when reported by the backend |
| **3. FUTURE CONSIDERATION**<br>*(Phase 2 / Phase 3 expansion; excluded from MVP launch)* | Advanced features that add unnecessary complexity to the initial release. Do not build in Phase 1 MVP. | • **Public Live Macro-Telemetry Counters & Guaranteed SLA Badges** (never hardcode unverified claims like `99.94% SLA` or static `18ms` latency; show real measured metrics in Phase 2 or simple operational status in MVP)<br>• **Side-by-Side 4-Model Comparison Drawer & Public Model Benchmark Subpages**<br>• **OpenAI `/v1/responses` Wire Protocol & Automated Security Audit Diff Viewers** |

### 1.3 Repository Technical Audit (Existing vs. Proposed Architecture)
An inspection of the project workspace reveals the following state, which frontend implementers must respect:
* **Currently Existing in Workspace:**
  1. Architecture & specification documents: `PRD.md`, `CLAUDE.md`, `IMPLEMENTATION_PLAN.md`, `UPSTREAM_SUPPLIER_DEEP_RESEARCH.md`, and `design.md`.
  2. Standalone single-file prototype: `artifacts/file_generation/ttl=63d/output/ai_gateway_app.html` (built with Tailwind CSS v3.4.17 CDN, Chart.js v4.4.1, `Inter` + `JetBrains Mono`, and vanilla JS state).
* **Proposed Target Architecture (Defined in `PRD.md` & `CLAUDE.md`, To Be Implemented):**
  1. `apps/web/` — React 19 + TypeScript + Vite + Tailwind CSS frontend application.
  2. `apps/api/` — Bun + Hono + Drizzle ORM (PostgreSQL 16) + Redis 7 backend server.
  * *Constraint:* Do not assume `apps/web/` components already exist on disk until scaffolded during Batch 1/Batch 5 of `IMPLEMENTATION_PLAN.md`.

## 2. Reference Research & Comparative Analysis

Direct research was conducted on the accessible web interfaces and documentation portals of six industry benchmarks: **OpenRouter** ([openrouter.ai](https://openrouter.ai/), [openrouter.ai/models](https://openrouter.ai/models), [openrouter.ai/pricing](https://openrouter.ai/pricing)), **Vercel** ([vercel.com](https://vercel.com/), [vercel.com/font](https://vercel.com/font)), **Linear** ([linear.app](https://linear.app/), [linear.app/now/how-we-redesigned-the-linear-ui](https://linear.app/now/how-we-redesigned-the-linear-ui)), **Portkey** ([portkey.ai](https://portkey.ai/)), **Together AI** ([docs.together.ai/docs/serverless/models](https://docs.together.ai/docs/serverless/models) — *note: root marketing page `www.together.ai` blocked automated access, so its live Mintlify developer catalog was inspected directly*), and **Cloudflare** ([cloudflare.com](https://www.cloudflare.com/), [developers.cloudflare.com](https://developers.cloudflare.com/realtime/realtimekit/humans/ui-kit/branding/design-system/)).

| Reference Platform | Strengths Observed | Weaknesses to Avoid | Design Principles Adopted for Katalis |
| :--- | :--- | :--- | :--- |
| **OpenRouter** | Global `Search ⌘K` in header; clear 3-step onboarding card (`1. Signup` $\rightarrow$ `2. Buy credits` $\rightarrow$ `3. Get your API key`); modality filter pills; `List` vs `Table` toggle on `/models`. | Default `/models` `List` view includes 100–200 word paragraphs per model, forcing heavy scrolling to compare prices; platform credit top-up fees (5.5%) are separated from token pricing. | Default `/models` to a **compact, sortable Table view** so 15+ models fit in one viewport; display transparent all-in pricing; keep onboarding to a 3-step checklist. |
| **Vercel** | Exposed `1px` structural hairline grids that divide sections cleanly without drop-shadow clutter; purposeful pairing of sans, mono, and serif typefaces; explicit `system / light / dark` theme switcher. | Public homepage repeats promotional slogans and uses a complex multi-column mega-menu that would feel heavy inside a daily API utility console. | Use **exposed `1px solid` hairline grids** for KPI strips and data tables; keep top navigation flat (maximum 4–5 top-level links); include an explicit `Light / Dark / System` theme selector. |
| **Linear** | Benchmark for high information density (`36px–40px` single-line rows); luminance-stepped surfaces; `Inter` with `tabular-nums`; 3-pane master-detail layout (Left Sidebar $\rightarrow$ Center List $\rightarrow$ Right Inspector Drawer). | Ultra-minimalist buttons can make primary financial actions (like adding credits) less obvious to first-time users. | Adopt Linear's **single-line table density** and **slide-over right inspector drawer** for Request Logs and Admin Routing while keeping primary CTAs (`+ Create API Key`, `Top Up Credits`) high-contrast. |
| **Portkey** | Clear AI Gateway mental model (`Observability`, `Prompt Caching`, `Budget Limits`); 3-line drop-in SDK code block on the landing page proving instant compatibility with existing OpenAI clients. | Enterprise security jargon (`PRISMA AIRS`, `SASE`) and unpopulated counter animations on marketing pages create friction for indie developers. | Place an **interactive 3-line SDK snippet** (`OpenAI Python/JS`, `cURL`, `Coding Agent Config`) on the landing page and dashboard overview; use plain engineering terminology. |
| **Together AI** | Exemplary tabular honesty in [docs.together.ai/docs/serverless/models](https://docs.together.ai/docs/serverless/models): columns explicitly show `Organization`, `Model name`, `API model string`, `Context length`, `Input`, `Cached input`, `Output`, and **`Quantization` (`FP8`, `NVFP4`, `MXFP4`)**. | Static documentation tables lack instant multi-criteria client-side filtering, price sorting, or an interactive cost estimator. | Include **`Cached Input`**, **`Context Length`**, and **`Quantization / Precision`** (when reported by upstream) as first-class sortable columns in the Model Catalog. |
| **Cloudflare** | Warm neutral backgrounds paired with amber/terracotta accents and crisp monospace telemetry badges; visual explanation of cost savings (idle wait time vs active compute). | Massive product catalog creates deep nested sidebar hierarchies (`CDN`, `WAF`, `Zero Trust`, `Workers`, `R2`). | Keep the Authenticated User Sidebar flat (**6 MVP links**); use warm terracotta (`#B77A45`) for active highlights and visual cost breakdowns (Uncached vs Cached tokens). |

## 3. Theme Strategy & Mathematically Verified Color System

### 3.1 Default Theme Recommendation for Developer Audience
* **Primary Default Theme — Warm Editorial Light (`#F0EEE8` / `#FAF9F5`):** Preserved as the default theme for the Public Website, Model Catalog, Pricing, and Documentation, as explicitly specified by the project's core color palette. High-contrast charcoal ink (`#282824`) on warm low-glare paper (`#FAF9F5`, **14.05:1** contrast) eliminates halation (astigmatism blur) when scanning multi-column pricing tables and reading documentation.
* **Paired Developer Theme — Obsidian Carbon Dark (`#0D0D0C` / `#1A1A17`):** Because developers and coding-agent users spend hours inside dark-mode IDEs (Cursor, VS Code, terminal), switching to a bright browser window at night causes eye strain. The platform must support **Obsidian Carbon Dark** via a 1-click header toggle (and `prefers-color-scheme: dark` option in the Dashboard/Playground), storing the preference in `localStorage`.

### 3.2 Mathematical WCAG 2.1 Contrast Audit & Token Separation
A strict mathematical audit using the WCAG 2.1 relative luminance formula ($L = 0.2126 R + 0.7152 G + 0.0722 B$ and $C = (L_{\text{bright}} + 0.05) / (L_{\text{dark}} + 0.05)$) revealed an important distinction in the Light Theme palette:
* The core semantic brand tokens (`#B77A45` Accent = **3.39:1**, `#54836A` Success = **4.13:1**, and `#C45E52` Error = **3.93:1** against `#FAF9F5` Surface) pass **WCAG AA Non-Text UI Component & Graphical Object Contrast (`≥ 3.00:1`)** (ideal for borders, status dots, progress bars, chart lines, and large icons), **but fall below the `4.50:1` threshold required for small text (`10px–13px`)**.
* Similarly, `#77746B` (Secondary) achieves **4.43:1** on `#FAF9F5` Surface and **4.03:1** on `#F0EEE8` Background.
* **Architectural Solution:** We preserve all 8 exact brand hex tokens for surfaces, borders, graphics, and fills, and pair them with **Mathematically Verified WCAG AA Text Companion Tokens (`≥ 4.50:1` on both `#FAF9F5` and `#F0EEE8`)** for all small text labels, table headers, and badge copy.

### 3.3 Complete Color Token Matrix (Exact HEX & Verified WCAG 2.1 Ratios)

| Semantic Role | CSS Custom Property | Light Theme HEX | Verified Light Contrast (vs `#FAF9F5` / `#F0EEE8`) | Dark Theme HEX | Verified Dark Contrast (vs `#1A1A17` / `#0D0D0C`) | Allowed Usage |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Primary Background** | `--bg-primary` | `#F0EEE8` | — | `#0D0D0C` | — | Main page canvas (`body`), recessed code/filter wells. |
| **Secondary Background** | `--bg-secondary` | `#E6E2D8` | — | `#141412` | — | Table headers (`thead`), skeleton bars, segmented tab tracks. |
| **Surface (Default)** | `--bg-surface` | `#FAF9F5` | — | `#1A1A17` | — | Cards, tables, sidebar, top header, modals, dropdowns. |
| **Surface (Hover)** | `--bg-surface-hover` | `#F3F1EB` | — | `#24231F` | — | Hovered table rows, active sidebar nav item background. |
| **Surface (Terminal)** | `--bg-terminal` | `#282824` | — | `#090908` | — | Multi-line code blocks (`pre`), JSON response inspector. |
| **Primary Text** | `--text-primary` | `#282824` | **14.05:1 / 12.75:1** (AAA) | `#F0EEE8` | **15.03:1 / 16.76:1** (AAA) | Headings, body copy, model names, KPI numbers, primary button fill. |
| **Secondary Text (Brand)** | `--text-secondary` | `#77746B` | **4.43:1 / 4.03:1** (AA Large) | `#A39E93` | **6.54:1 / 7.29:1** (AA) | Subtitles $\ge 14\text{px}$ medium, icons, secondary metadata on `#FAF9F5`. |
| **Secondary Text (AA Small)** | `--text-secondary-aa` | `#6E6B62` | **5.06:1 / 4.59:1** (AA) | `#A39E93` | **6.54:1 / 7.29:1** (AA) | Small `11px–12px` table headers (`TH`), form labels, and captions on `#F0EEE8`. |
| **Muted Text (Decorative)** | `--text-muted` | `#8C887E` | **3.32:1 / 3.01:1** (UI Pass) | `#8A857A` | **4.75:1 / 5.29:1** (AA) | Input placeholders, disabled states, slash separators (`/`). |
| **Border (Default)** | `--border-default` | `#DCD8CE` | 1.35:1 (Hairline) | `#2A2925` | 1.20:1 (Hairline) | `1px solid` card borders, table row dividers, chart grid lines. |
| **Border (Strong)** | `--border-strong` | `#B8B2A6` | 1.98:1 | `#42403A` | 1.72:1 | Hovered input borders, active card outlines. |
| **Accent (Graphic / Border)** | `--accent-primary` | `#B77A45` | **3.39:1 / 3.08:1** (AA UI) | `#D4955A` | **6.85:1 / 7.64:1** (AA) | Active tab indicator bar, focus rings, progress bars, Dark Mode accent text. |
| **Accent (AA Small Text / Button Fill)** | `--accent-text` | `#8F5B2D` | **5.38:1 / 4.89:1** (AA) | `#D4955A` | **6.85:1 / 7.64:1** (AA) | Small accent text links, badge labels, and solid Accent button fill (with `#FAF9F5` text = **5.38:1**). |
| **Success (Graphic / Dot)** | `--state-success` | `#54836A` | **4.13:1 / 3.75:1** (AA UI) | `#68A382` | **5.94:1 / 6.62:1** (AA) | Status dots, health bars, chart lines, Dark Mode success text. |
| **Success (AA Small Text)** | `--success-text` | `#3D6B52` | **5.82:1 / 5.29:1** (AA) | `#68A382` | **5.94:1 / 6.62:1** (AA) | `200 OK` badge text, `PAID` status text, positive balance figures in Light Mode. |
| **Warning (Graphic / Bar)** | `--state-warning` | `#B5761E` | **3.47:1 / 3.15:1** (AA UI) | `#E0A346` | **7.89:1 / 8.79:1** (AAA) | Warning icons, quota progress bar $>80\%$, Dark Mode warning text. |
| **Warning (AA Small Text)** | `--warning-text` | `#8C5E1A` | **5.34:1 / 4.85:1** (AA) | `#E0A346` | **7.89:1 / 8.79:1** (AAA) | `429 Rate Limit` badge text, low-balance warning copy in Light Mode. |
| **Error (Graphic / Border)** | `--state-error` | `#C45E52` | **3.93:1 / 3.57:1** (AA UI) | `#E07265` | **5.62:1 / 6.26:1** (AA) | Error alert borders, destructive icon indicators, Dark Mode error text. |
| **Error (AA Small Text)** | `--error-text` | `#A33E32` | **6.05:1 / 5.50:1** (AA) | `#E07265` | **5.62:1 / 6.26:1** (AA) | `401/502` error badge text, form validation errors, `Revoke` button text in Light Mode. |
| **Information (Graphic & Text)** | `--state-info` | `#3B6E8C` | **5.25:1 / 4.77:1** (AA) | `#5B9BD5` | **5.89:1 / 6.57:1** (AA) | Protocol capability badges, cache-hit callouts, informational banners. |

### 3.4 Tinted Badge Surface Tokens
Status badges use a `12%` alpha background fill of the graphic token, a `30%` alpha `1px` border, and the **AA Small Text token** (`--accent-text`, `--success-text`, `--warning-text`, `--error-text`, `--state-info`) for the label text so every badge achieves `> 4.8:1` contrast.

## 4. Typography System

### 4.1 Font Families & Technical Discipline
1. **Editorial Display Serif (`--font-serif`):** `'Newsreader', Georgia, serif`
   * **Scope:** Used selectively for Public Page Titles (`H1`), Documentation Article Titles, and Empty State Titles to establish the Warm Editorial identity. Never used inside data tables, inputs, or compact dashboard controls.
2. **Primary UI Sans-Serif (`--font-sans`):** `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
   * **Scope:** All dashboard page headers, navigation items, buttons, form controls, table text cells, and prose descriptions.
   * **OpenType Disambiguation:** `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` (distinguishes `1`, `I`, `l`, and `0`).
3. **Technical & Numeric Monospace (`--font-mono`):** `'JetBrains Mono', monospace`
   * **Scope:** Model ID slugs (`deepseek-v4.1-flash`), API keys (`sk-ktl-...`), endpoint URLs, token counts, prices, latency metrics (`ms`), timestamps, HTTP status codes, and code snippets.
   * **Mandatory Rules:** `font-variant-numeric: tabular-nums slashed-zero` and `font-variant-ligatures: none` (prevents ligatures from merging characters inside API keys or model IDs).

### 4.2 Typographic Scale Matrix

| Scale Token | Target Element | Font Family | Size (`px` / `rem`) | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **`display-hero`** | Public Landing Headline | `Newsreader` | `32px` / `2.00rem` | `500` | `38px` (`1.19`) | `-0.02em` (`text-balance`) |
| **`heading-editorial`** | Public & Docs Page Title (`H1`) | `Newsreader` | `22px` / `1.375rem` | `500` | `28px` (`1.27`) | `-0.015em` (`text-balance`) |
| **`heading-dashboard`** | Dashboard & Admin Page Title (`H1`) | `Inter` | `18px` / `1.125rem` | `600` | `24px` (`1.33`) | `-0.015em` |
| **`heading-section`** | Section Heading (`H2`) | `Inter` | `15px` / `0.9375rem` | `600` | `22px` (`1.46`) | `-0.01em` |
| **`heading-card`** | Card / Modal Title (`H3`) | `Inter` | `13px` / `0.8125rem` | `600` | `18px` (`1.38`) | `-0.005em` |
| **`overline-mono`** | Table Header (`TH`) / Panel Label | `JetBrains Mono` | `11px` / `0.6875rem` | `600` | `16px` (`1.45`) | `+0.05em` (`UPPERCASE`) |
| **`metric-kpi`** | Primary KPI Card Numeral | `JetBrains Mono` | `22px` / `1.375rem` | `600` | `28px` (`1.27`) | `-0.02em` (`tabular-nums`) |
| **`body-prose`** | Documentation Prose | `Inter` | `14px` / `0.875rem` | `400` | `22px` (`1.57`) | `0em` (`max-w-[65ch]`) |
| **`body-ui`** | Standard UI / Table Cell Text | `Inter` | `13px` / `0.8125rem` | `400` / `500` | `18px` (`1.38`) | `-0.005em` |
| **`body-caption`** | Helper Text / Subtitles | `Inter` | `12px` / `0.75rem` | `400` | `16px` (`1.33`) | `0em` |
| **`mono-data`** | Model Slugs, Prices, Code Blocks | `JetBrains Mono` | `12px` / `0.75rem` | `400` / `500` | `18px` (`1.50`) | `0em` (`tabular-nums`) |
| **`mono-badge`** | Status Badges, `kbd` Shortcuts | `JetBrains Mono` | `10px`–`11px` | `500` | `14px` (`1.27`) | `+0.02em` |

### 4.3 Split-Weight Currency & Unit Formatting
When rendering prices or balances in KPI cards and tables, de-emphasize currency symbols and units (`Rp`, `$`, `/1M`, `ms`) using `--text-secondary-aa` (`11px–12px` regular weight) next to `--text-primary` (`600` weight) for the numeric value so columns scan effortlessly.

## 5. Spacing and Layout System

### 5.1 Spatial Grid & Shell Dimensions

| Dimension Token | Value | Specification & Usage |
| :--- | :---: | :--- |
| **Base Spatial Grid** | `4px` (`0.25rem`) | All spacing uses `4px` increments (`4, 8, 12, 16, 20, 24, 32, 48px`). |
| **Public Container Width** | `1280px` (`max-w-7xl`) | Centered layout with `16px` (`px-4`) mobile and `24px` (`sm:px-6`) desktop horizontal padding. |
| **Authenticated Workspace Max Width** | `1440px` (`max-w-[1440px]`) | Fluid workspace container inside the main content area to the right of the sidebar. |
| **Documentation Prose Width** | `65ch` (`max-w-[65ch]`) | Hard line-length limit on documentation paragraphs to prevent eye fatigue. |
| **Left Sidebar Width (Dashboard/Admin)** | `240px` (Expanded)<br>`60px` (Collapsed) | Fixed left navigation rail (`w-60`) on `≥1024px`; collapses to `60px` icon rail on tablet (`768px–1023px`) and off-canvas drawer on mobile (`<768px`). |
| **Top Header Height** | `56px` (`h-14`) | Sticky top bar (`sticky top-0 z-30`) across both Public and Authenticated shells. |
| **Table Row Height** | `38px` (Logs)<br>`44px` (Models / Keys) | Single-line rows with `truncate` to maximize vertical scan density without multi-line row wrap. |
| **Card Internal Padding** | `14px`–`16px` (`p-3.5` / `p-4`) | Compact internal padding for KPI cards and form panels. |

### 5.2 Two Distinct Layout Shells (Resolving Navigation Clarity)
To avoid mixing public marketing links with authenticated workspace tools, the application uses two distinct layout shells:
1. **Public Layout Shell (`/`, `/models`, `/pricing`, `/docs`, `/login`, `/register`):**
   * Sticky `56px` Top Header containing: Brand Logo (`Left`), 3 Public Nav Links (`Models`, `Pricing`, `Docs`), `Search ⌘K` trigger, Theme Toggle, `Sign In`, and `Get API Key` CTA (`Right`). No left sidebar (except internal section links on `/docs`).
2. **Authenticated Workspace Shell (`/dashboard/*` and `/admin/*`):**
   * Persistent `240px` Left Sidebar containing workspace navigation links and a bottom wallet balance summary card.
   * Slim `56px` Top Utility Header containing: Page Breadcrumb/Title (`Left`), `Search ⌘K` trigger, Copyable Base URL chip, Wallet Balance Pill + `+ Top Up` shortcut, Theme Toggle, and User Profile Menu (`Right`).

## 6. Component Design Specifications

To prevent component proliferation, the system standardizes on **17 core reusable primitives** (consolidating all overlays into `Modal` and `SlideOverDrawer`). All interactive controls use `4px` (`rounded`) corners; all structural containers use `6px` (`rounded-md`) corners and `1px solid var(--border-default)` hairline borders.

| # | Component Primitive | Geometry & Sizing | Default Visual State | Hover, Active & Focus States | Disabled, Loading & Error States |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Button** | `rounded` (`4px`), `1px solid`<br>`sm`: `h-7 px-2.5 text-xs`<br>`md`: `h-8 px-3 text-xs`<br>`lg`: `h-9 px-4 text-[13px]` | **Primary:** `bg-[var(--text-primary)] text-[var(--bg-surface)]`<br>**Accent:** `bg-[var(--accent-text)] text-[#FAF9F5]` (**5.38:1**)<br>**Secondary:** `bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-default)]`<br>**Danger:** `bg-[rgba(196,94,82,0.12)] text-[var(--error-text)] border-[rgba(196,94,82,0.3)]` | **Hover:** Primary `opacity-90`; Secondary `bg-[var(--bg-primary)] border-[var(--border-strong)]`<br>**Active:** `translate-y-[0.5px]`<br>**Focus:** `ring-2 ring-[var(--accent-primary)]/40 outline-none` | **Disabled:** `opacity-45 cursor-not-allowed pointer-events-none`<br>**Loading:** Inline `12px` spinner + label (`Creating...`). |
| **2** | **Input (Text / Number / Search)** | `rounded` (`4px`), `1px solid var(--border-default)`, `h-8 px-3 text-xs` (`h-9` on Auth forms) | `bg-[var(--bg-surface)] text-[var(--text-primary)]`, placeholder `text-[var(--text-muted)]` | **Hover:** `border-[var(--border-strong)]`<br>**Focus:** `border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20 outline-none` | **Disabled:** `bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed`<br>**Error:** `border-[var(--state-error)] ring-1 ring-[var(--state-error)]/30` + `11px` `--error-text` message below. |
| **3** | **Select & Dropdown Menu** | Trigger: `rounded` (`4px`), `h-8 pl-3 pr-8 text-xs`<br>Menu: `rounded-md` (`6px`), `shadow-lg p-1` | Trigger & Menu: `bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-default)]` | **Item Hover / Arrow Focus:** `bg-[var(--bg-primary)] rounded` (`4px`)<br>**Trigger Focus:** `border-[var(--accent-primary)]` | Supports keyboard arrow navigation (`↑`/`↓`), `Enter` to select, `Esc` to close. |
| **4** | **Data Table** | Wrapper: `rounded-md` (`6px`), `1px solid var(--border-default)`, `overflow-x-auto` | **TH:** `py-2 px-3 bg-[var(--bg-secondary)] text-[var(--text-secondary-aa)] font-mono text-[11px] uppercase`<br>**TD:** `py-2.5 px-3 bg-[var(--bg-surface)] text-[13px] border-t border-[var(--border-default)]` | **Row Hover:** `bg-[var(--bg-surface-hover)]`<br>**Sortable TH Hover:** `text-[var(--text-primary)] cursor-pointer` with `↑/↓` indicator | Numeric columns strictly `text-right font-mono tabular-nums`. Preserves `thead` during loading and renders 5–8 skeleton rows. |
| **5** | **Card** | `rounded-md` (`6px`), `1px solid var(--border-default)`, `p-3.5` or `p-4`, `shadow-none` | `bg-[var(--bg-surface)] text-[var(--text-primary)]` | Interactive selectable card: `hover:border-[var(--border-strong)]`; Selected: `border-[var(--accent-primary)] bg-[rgba(183,122,69,0.05)]` | Static cards never have hover elevation or drop shadows. |
| **6** | **Badge** | `rounded` (`4px`), `1px solid` (`30%` alpha), `px-1.5 py-0.5 text-[10px] font-mono font-medium` | Neutral: `bg-[var(--bg-secondary)] text-[var(--text-secondary-aa)] border-[var(--border-default)]`; Semantic states use 12% alpha fill + AA text token (Section 3.4) | Filter badge hover: `border-[var(--accent-primary)] cursor-pointer` | Always pairs color with explicit text or symbol (`● 200 OK`, `▲ 429`). |
| **7** | **Tooltip** | `rounded` (`4px`), `1px solid #42403A`, `px-2 py-1 text-[11px] shadow-md max-w-[260px]` | `bg-[#282824] text-[#FAF9F5]` | Appears after `150ms` delay on `:hover` and `:focus-visible` | Used for explaining column headers (`Cached Input`, `Quantization`) and showing full timestamps. |
| **8** | **Dialog Modal** | `rounded-md` (`6px`), `1px solid var(--border-default)`, `shadow-2xl max-w-md w-full` | Backdrop: `bg-[#282824]/50 backdrop-blur-[2px]`; Panel: `bg-[var(--bg-surface)]` | Focus trapped inside modal (`Tab`/`Shift+Tab`); `Esc` closes modal | Used for `CreateApiKeyModal`, `OneTimeKeyRevealModal`, `DynamicQrisModal`, `RevokeConfirmModal`, and `CommandPaletteModal (⌘K)`. |
| **9** | **Slide-Over Drawer** | Right-anchored panel `w-full max-w-[420px] h-full border-l border-[var(--border-default)] shadow-2xl` | `bg-[var(--bg-surface)]` sliding in from right edge (`180ms` ease-out) | Close button (`×`) or `Esc` dismisses drawer | Used for `RequestTraceInspectorDrawer` (on `/dashboard/logs`) and `AdminEditDrawer` (avoiding full-page navigation for row inspection). |
| **10** | **Segmented Tabs** | Track: `rounded` (`4px`), `p-0.5 bg-[var(--bg-secondary)] border border-[var(--border-default)]` | Inactive tab: `px-3 py-1 text-xs text-[var(--text-secondary-aa)]` | **Active Tab:** `bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium rounded-[3px] shadow-2xs` | Supports Left/Right arrow navigation (`role="tablist"`). |
| **11** | **Top Header & Left Sidebar** | Header: `h-14 border-b`<br>Sidebar: `w-60 border-r` | `bg-[var(--bg-surface)] border-[var(--border-default)]` | Active Sidebar Link: `bg-[var(--bg-primary)] text-[var(--text-primary)] font-semibold border-l-2 border-[var(--accent-primary)]` | Sidebar collapses into slide-over drawer on `<768px`. |
| **12** | **Toast Notification** | `rounded` (`4px`), `1px solid #42403A`, `px-3.5 py-2.5 text-xs font-mono shadow-lg` | Fixed `bottom-4 right-4 z-50 bg-[#282824] text-[#FAF9F5]` with left status dot | Auto-dismisses after `2800ms` (manual close on error toasts) | Uses `role="status" aria-live="polite"`. |
| **13** | **Empty State Box** | `rounded-md` (`6px`), `1px dashed var(--border-default)`, `p-8 text-center` | `bg-[var(--bg-surface)]/50`, Title in `Newsreader 16px`, helper text in `12px var(--text-secondary-aa)` | Primary CTA button centered below description | Mandatory whenever a table, chart, or filter returns 0 items. |
| **14** | **Skeleton Loader** | `rounded` (`4px`), matches exact geometry of target row/card | `bg-[var(--bg-secondary)] animate-pulse` | — | Prevents cumulative layout shift (CLS) during async fetches. |
| **15** | **Error Banner** | `rounded-md` (`6px`), `1px solid rgba(196,94,82,0.4)`, `p-4` | `bg-[rgba(196,94,82,0.08)]`, error code in `font-mono text-xs font-semibold text-[var(--error-text)]` | Actionable recovery button (`Retry` or `Top Up Credits`) | Surfaces exact HTTP status and machine error code. |
| **16** | **Chart Container** | Card wrapper with inner `<div class="relative h-64 w-full">` | Primary series `#54836A`, Secondary `#B77A45`, Info `#3B6E8C`; grid `#DCD8CE` | Crosshair tooltip in `bg-[#282824] text-[#FAF9F5] font-mono text-[11px] tabular-nums` | **Locked Rule:** `maintainAspectRatio: false` on all Chart.js instances. |
| **17** | **Code Block & Copy Button** | Block: `rounded-md` (`6px`), `bg-[var(--bg-terminal)] text-[#FAF9F5] p-3.5 text-xs font-mono` | Header bar `h-8 px-3 bg-[#1E1E1B]` with language tabs and `CopyButton` | `CopyButton` swaps to `✓ Copied` (`#68A382`) for `1500ms` on click | Dynamically injects base URL, selected model ID, and user key placeholder. |

## 7. Application Information Architecture & MVP Prioritization

To ensure a focused, high-velocity initial release, every page across the Public Website, Authenticated User Dashboard, and Admin Panel is strictly prioritized into **MVP (Phase 1 — Required for Launch)**, **Phase 2 (Core Expansion)**, or **Phase 3 (Advanced Scale)**. Duplicate views between Public and Authenticated zones are consolidated via shared view components.

### 7.1 Complete Information Architecture & Phasing Table

| Zone | Route Path | Page Title | Release Priority | Architectural Consolidation & Scope Notes |
| :--- | :--- | :--- | :---: | :--- |
| **Public Website** | `/` | **P1. Landing Page** | **MVP (Phase 1)** | Hero with 3-line drop-in SDK snippet, featured model pricing preview, and 3-step onboarding flow. |
| **Public Website** | `/models` | **P2. Models Catalog** | **MVP (Phase 1)** | Shared `<ModelCatalogView />` component: search, filters, sortable pricing table, copyable slugs. |
| **Public Website** | `/models/:provider/:slug` | **P3. Model Details** | **Phase 2** | In MVP, clicking a model row opens a lightweight detail modal or jumps to Playground; dedicated benchmark page is Phase 2. |
| **Public Website** | `/pricing` | **P4. Pricing & Calculator** | **MVP (Phase 1)** | Transparent model rates, billing rules explanation, and interactive token/cache cost calculator. |
| **Public Website** | `/docs` | **P5. Documentation** | **MVP (Phase 1)** | Shared `<DocumentationView />` component: Quickstart, OpenAI SDK, Coding Agents (`Cline`, `Aider`, `Claude Code`), Error Codes. |
| **Public Website** | `/login` | **P6. Login** | **MVP (Phase 1)** | Email/Password + Google OAuth login card. |
| **Public Website** | `/register` | **P7. Registration** | **MVP (Phase 1)** | Fast developer registration redirecting directly to `/dashboard`. |
| **User Dashboard** | `/dashboard` | **U1. Overview** | **MVP (Phase 1)** | Wallet balance, active pass/quota summary (if configured), 7-day usage chart, and quick onboarding checklist. |
| **User Dashboard** | `/dashboard/keys` | **U2. API Keys** | **MVP (Phase 1)** | Create, label, set spend caps, pause, and revoke multiple `sk-ktl-...` API keys. |
| **User Dashboard** | `/dashboard/models` | **U3. Dashboard Models** | **Phase 2** | Reuses `<ModelCatalogView />` inside `DashboardLayout` with personalized key injection. |
| **User Dashboard** | `/dashboard/analytics` | **U4. Usage Analytics** | **MVP (Phase 1)** | Daily/monthly spend and token composition (Input, Cached Input, Output) by model and key + CSV export. |
| **User Dashboard** | `/dashboard/logs` | **U5. Request Logs** | **MVP (Phase 1)** | promoted to **MVP** for developer request debugging: recent request table (Timestamp, Model, Key, Tokens, Latency, HTTP Status). |
| **User Dashboard** | `/dashboard/credits` | **U6. Credits / Top-Up** | **MVP (Phase 1)** | Prepaid credit selection, promo code input, and dynamic QRIS generation modal with live webhook polling. |
| **User Dashboard** | `/dashboard/billing` | **U7. Transactions History** | **MVP (Phase 1)** | Ledger of past top-ups/invoices (`PAID`, `PENDING`, `EXPIRED`) and printable receipts. |
| **User Dashboard** | `/dashboard/playground` | **U8. API Playground** | **MVP (Phase 1)** | Interactive browser tester for `/v1/chat/completions` with live token/cost receipt and cURL generator. |
| **User Dashboard** | `/dashboard/docs` | **U9. Embedded Docs** | **Phase 2** | Reuses `<DocumentationView />` inside `DashboardLayout` (in MVP, sidebar `Docs` link opens `/docs`). |
| **User Dashboard** | `/dashboard/settings` | **U10. Account Settings** | **MVP (Phase 1)** | Password update, OAuth status, and low-balance alert threshold. |
| **Admin Panel** | `/admin` | **A1. Admin Overview** | **MVP (Phase 1)** | Platform revenue, upstream spend, error rate, and upstream balance alerts. |
| **Admin Panel** | `/admin/users` | **A2. User Management** | **MVP (Phase 1)** | Search users, view wallet ledger, manual balance adjustment, account suspension. |
| **Admin Panel** | `/admin/models` | **A3. Model Management** | **MVP (Phase 1)** | Enable/disable catalog models, edit display metadata, capabilities, and context limits. |
| **Admin Panel** | `/admin/providers` | **A4. Upstream Providers** | **MVP (Phase 1)** | Configure upstream base URLs, timeouts, and health status. |
| **Admin Panel** | `/admin/credentials` | **A5. Provider Credentials** | **MVP (Phase 1)** | Encrypted upstream API key vault, rotation, and concurrency caps. |
| **Admin Panel** | `/admin/routing` | **A6. Routing Configuration** | **MVP (Phase 1)** | Map canonical model slugs to ordered upstream provider priority chains and failover rules. |
| **Admin Panel** | `/admin/pricing` | **A7. Pricing & Multipliers** | **MVP (Phase 1)** | Configure upstream cost baselines, gross margin targets / multipliers, and published customer rates. |
| **Admin Panel** | `/admin/requests` | **A8. Request Monitoring** | **Phase 2** | Global real-time request stream across all tenants with failover hop inspection. |
| **Admin Panel** | `/admin/revenue` | **A9. Revenue Analytics** | **Phase 2** | Deep cohort margin analytics and pass utilization reports. |
| **Admin Panel** | `/admin/health` | **A10. System Health** | **Phase 2** | Redis/PostgreSQL vitals and synthetic upstream probe timelines. |
| **Admin Panel** | `/admin/audit-logs` | **A11. Audit Logs** | **Phase 3** | Immutable log of admin mutations with JSON before/after diffs. |
| **Admin Panel** | `/admin/settings` | **A12. Platform Settings** | **MVP (Phase 1)** | Payment gateway webhook config, global FX reference rate, and maintenance banners. |

## 8. Page-by-Page UI Specifications

### 8.1 Public Website Specifications

#### P1. Landing Page (`/`) — *[MVP]*
* **Purpose:** Communicate the developer value proposition immediately and provide a frictionless path to inspecting model prices or generating an API key.
* **Main Content:**
  * **Split Above-the-Fold Workbench:** Left column presents the headline (`Unified OpenAI-Compatible API for Frontier Chinese & Global Models`), copyable Base URL chip, and primary CTAs (`Get API Key`, `Browse Models`); Right column presents a live 3-tab code switcher (`Python OpenAI SDK`, `TypeScript / Node`, `Coding Agents: Cline / Aider / Claude Code`) showing a 3-line base URL change.
  * **Featured Model Rates Table:** Live preview of 6–8 popular models pulled from `/v1/models` showing Input, Cached Input, and Output prices per 1M tokens.
  * **3-Step Developer Onboarding Strip:** `1. Create Account` $\rightarrow$ `2. Top Up Credits via QRIS` $\rightarrow$ `3. Create API Key & Route Requests`.
* **Important Components:** `HeroCodeSwitcher`, `FeaturedModelsTable`, `OnboardingStepsGrid`, `CommandPaletteModal (⌘K)`.
* **Primary Actions:** `Get API Key` (`/register`), `Explore Full Catalog` (`/models`), `Copy Base URL`.
* **Navigation Relationships:** Top header links to `/models`, `/pricing`, `/docs`, `/login`, `/register`.
* **Empty / Loading / Error States:** *Loading:* Skeleton rows in featured table; *Empty/Error:* If `/v1/models` fetch fails, hide dynamic table rows and show a direct CTA button to `/docs` with a `Retry` control.

#### P2. Models Catalog (`/models`) & U3. Dashboard Models (`/dashboard/models`) — *[P2: MVP | U3: Phase 2]*
* **Purpose:** Enable rapid discovery, filtering, and price comparison across all active models served by the gateway.
* **Main Content:**
  * **Filter Toolbar:** Instant search input (`⌘K`), Capability filter chips (`All`, `Reasoning`, `Vision`, `Tool Calling`, `JSON Mode`), optional Tier/Protocol chips (rendered dynamically from available model metadata), and Currency display toggle (`IDR` vs `USD` per 1M tokens).
  * **High-Density Catalog Table:** Columns for `Model Name & Provider`, `API Model Slug` (1-click copy chip), `Capabilities & Precision` (e.g., `FP8`, `Tools`, `Vision` badges), `Context / Max Out`, `Input / 1M`, `Cached Input / 1M`, `Output / 1M`, and `Action` (`Try in Playground`).
* **Important Components:** `ModelFilterToolbar`, `DataTable`, `CopyButton`, `ModelComparisonDrawer` *(Phase 2)*.
* **Primary Actions:** Search/filter models, sort by Input/Output/Cached price, copy model slug, launch Playground with selected model.
* **Navigation Relationships:** Links to `/models/:provider/:slug` *(Phase 2)* and `/dashboard/playground?model=...`.
* **Empty / Loading / Error States:** *Loading:* 10 skeleton rows (`h-11`); *Empty:* Dashed box (`No models match your active filters`) + `Reset Filters` button; *Error:* Error banner with `Retry` button.

#### P3. Model Details (`/models/:provider/:slug`) — *[Phase 2]*
* **Purpose:** Display comprehensive technical parameters, context limits, rate limits, and pre-filled SDK snippets for a single model.
* **Main Content:** Model title, copyable canonical slug, capability badges, 3-card pricing breakdown (`Input`, `Cached Input`, `Output`), context window & max output specs, and multi-language integration code block.
* **Important Components:** `ModelSpecCards`, `CodeBlock`, `CopyButton`.
* **Primary Actions:** `Copy Model ID`, `Open in Playground`, `Get API Key`.
* **Navigation Relationships:** Breadcrumb back to `/models`.
* **Empty / Loading / Error States:** *Loading:* Skeleton spec cards; *Empty:* N/A; *Error:* `404 Model Not Found` card with link to `/models`.

#### P4. Pricing & Cost Calculator (`/pricing`) — *[MVP]*
* **Purpose:** Provide full transparency into token billing and allow developers to estimate workload costs (including prompt cache savings).
* **Main Content:**
  * **Billing Options Grid:** Renders active billing options returned by `/api/billing/plans` (e.g., `Prepaid Pay-As-You-Go Wallet` with no expiration, plus any active promotional or pass tiers).
  * **Interactive Workload Cost Calculator:** Dropdown to select any model, number inputs/sliders for `Input Tokens (M)`, `Output Tokens (M)`, and `Expected Cache Hit %`, outputting itemized estimated cost.
  * **Complete Model Rate Reference Table** & **Billing FAQ Accordion**.
* **Important Components:** `BillingPlanCard`, `TokenCostCalculator`, `DataTable`.
* **Primary Actions:** `Calculate Estimate`, `Start Building` (`/register` or `/dashboard/credits`).
* **Navigation Relationships:** Links to `/register`, `/dashboard/credits`, and `/models`.
* **Empty / Loading / Error States:** *Loading:* Calculator skeleton; *Empty:* Pre-populated with default `10M Input / 2M Output` values; *Error:* Error banner with retry.

#### P5. Public Documentation (`/docs`) & U9. Embedded Docs (`/dashboard/docs`) — *[P5: MVP | U9: Phase 2]*
* **Purpose:** Deliver clear, copy-pasteable integration guides for OpenAI SDKs and popular coding agents.
* **Main Content:** Left navigation rail (`220px`) + center prose container (`max-w-[65ch]`) covering: `Quickstart`, `Authentication`, `Chat Completions & Streaming`, `Prompt Caching`, `Coding Agent Setup (Cline, Roo Code, Aider, Continue, Claude Code)`, and `Standard HTTP Error Codes (401, 402, 429, 502)`.
* **Important Components:** `DocsSidebarNav`, `CodeBlock`, `ErrorCodeTable`.
* **Primary Actions:** `Copy Code Snippet`, `Jump to Section`, `Test in Playground`.
* **Navigation Relationships:** Links to `/dashboard/keys` and `/dashboard/playground`.
* **Empty / Loading / Error States:** *Loading:* Prose skeleton lines; *Empty:* Search no-results message; *Error:* Reload button.

#### P6. Login (`/login`) & P7. Registration (`/register`) — *[MVP]*
* **Purpose:** Authenticate developers with minimal friction.
* **Main Content:** Centered surface card (`max-w-[400px]`, `p-6`) featuring OAuth buttons (`Continue with Google` / `GitHub`), hairline divider, Email & Password fields, and submit button.
* **Important Components:** `Card`, `Input`, `Button`, `ErrorBanner`.
* **Primary Actions:** `Sign In`, `Create Account`, `OAuth Login`.
* **Navigation Relationships:** Redirects to `/dashboard` on success; cross-links between `/login` and `/register`.
* **Empty / Loading / Error States:** *Loading:* Submit button disabled with spinner; *Empty:* Clean form; *Error:* Inline error banner (`401 Invalid email or password` or `409 Email already registered`).

### 8.2 Authenticated User Dashboard Specifications

#### U1. Overview (`/dashboard`) — *[MVP]*
* **Purpose:** Provide an at-a-glance summary of account balance, recent token consumption, and quick-start setup steps.
* **Main Content:**
  * **Top KPI Row:** `Wallet Balance` (with `+ Top Up` button), `24h Token Volume`, `24h Spend`, and `Active API Keys Count` (plus conditional `Active Pass / Bonus Quota` card if enabled by backend config).
  * **7-Day Usage Chart:** Fixed-height (`h-64`) bar/line chart of daily token consumption and spend.
  * **New-User Quickstart Checklist:** Conditionally displayed at the top when `total_requests === 0` (`1. Create API Key` $\rightarrow$ `2. Add Credits` $\rightarrow$ `3. Send First Request`).
* **Important Components:** `Card`, `ChartContainer`, `OnboardingChecklistCard`, `CodeBlock`.
* **Primary Actions:** `+ Top Up Credits`, `+ Create API Key`, `Open Playground`.
* **Navigation Relationships:** Links to `/dashboard/keys`, `/dashboard/credits`, `/dashboard/analytics`, `/dashboard/logs`.
* **Empty / Loading / Error States:** *Loading:* 4 KPI skeletons + chart skeleton; *Empty:* Quickstart checklist shown when 0 requests exist; *Error:* Retry banner.

#### U2. API Keys (`/dashboard/keys`) — *[MVP]*
* **Purpose:** Full lifecycle management of multiple project/agent API keys under one developer account.
* **Main Content:**
  * Page header with `+ Create New API Key` button.
  * **API Keys Table:** `Name / Label`, `Masked Prefix` (`sk-ktl-9f8a...`), `Spend Limit` (`Rp 12.400 / Rp 50.000` with progress bar, or `No Limit`), `Last Used`, `Created Date`, `Status` (`Active` / `Paused`), and `Actions` (`Edit Limit`, `Pause/Resume`, `Revoke`).
  * **Modals:** `CreateApiKeyModal` (Name + optional Spend Cap) and `OneTimeKeyRevealModal` (displays full `sk-ktl-...` secret once with copy button and security notice).
* **Important Components:** `DataTable`, `DialogModal`, `CopyButton`, `Badge`.
* **Primary Actions:** `+ Create New API Key`, `Copy Secret Key (Once)`, `Edit Spend Limit`, `Revoke Key`.
* **Navigation Relationships:** Clicking a key's usage count filters `/dashboard/logs?key_id=...`.
* **Empty / Loading / Error States:** *Loading:* 4 skeleton rows; *Empty:* Dashed card explaining multi-key isolation with `+ Create First API Key` CTA; *Error:* Actionable error toast/banner.

#### U4. Usage Analytics (`/dashboard/analytics`) — *[MVP]*
* **Purpose:** Track historical spending and token composition across models and API keys.
* **Main Content:**
  * **Filter Bar:** Date range selector (`24h`, `7d`, `30d`, `Current Month`), granularity (`Daily` / `Monthly`), API Key filter, Model filter, and `Export CSV` button.
  * **Summary KPI Strip:** `Total Spend`, `Total Requests`, `Uncached Input Tokens`, `Cached Input Tokens`, `Output Tokens`.
  * **Charts & Breakdown Table:** Daily stacked token/spend chart (`h-64`) + Model-level breakdown table.
* **Important Components:** `Select`, `ChartContainer`, `DataTable`, `Button (Export CSV)`.
* **Primary Actions:** Filter date/key/model, export CSV.
* **Navigation Relationships:** Drills down into `/dashboard/logs`.
* **Empty / Loading / Error States:** *Loading:* Chart & table skeletons; *Empty:* `No usage recorded for this period`; *Error:* Retry banner.

#### U5. Request Logs (`/dashboard/logs`) — *[MVP]*
* **Purpose:** Let developers inspect recent API calls to verify model routing, token counts, latency, and HTTP status codes during integration debugging.
* **Main Content:**
  * **Filter Toolbar:** Filter by Status (`All`, `200 OK`, `4xx Client Error`, `429 Rate Limit`, `5xx Upstream Error`), API Key, and Model.
  * **Compact Request Log Table (`38px` rows):** `Timestamp`, `Status Badge`, `Model Slug`, `Key Prefix`, `Input / Cached / Output Tokens`, `Latency (ms)`, `Cost`.
  * **Slide-Over Trace Drawer *(Phase 2 enhancement; simple expandable row or modal in MVP)*:** Shows request ID, error code message, and token billing breakdown.
* **Important Components:** `DataTable`, `Badge`, `SlideOverDrawer`.
* **Primary Actions:** Filter by error code, inspect request metadata, refresh logs.
* **Navigation Relationships:** Linked from `/dashboard/keys` and `/dashboard/analytics`.
* **Empty / Loading / Error States:** *Loading:* 10 compact skeleton rows; *Empty:* `No requests logged yet` + `Send Test Request in Playground`; *Error:* Retry button.

#### U6. Credits / Balance & Top-Up (`/dashboard/credits`) — *[MVP]*
* **Purpose:** Enable self-serve wallet top-ups and pass purchases with automated payment verification.
* **Main Content:**
  * **2-Column Checkout Layout:** Left column (`2/3`) displays current wallet balance, amount selector presets/custom input (driven by backend min/max config), and optional promo code input; Right column (`1/3`) displays itemized payment summary and `Generate QRIS Payment` primary CTA.
  * **Dynamic QRIS Payment Modal:** Displays generated QR code, invoice reference ID, expiration countdown timer (`tabular-nums`), and real-time webhook status indicator (`Waiting for payment...` $\rightarrow$ `Payment Verified!`).
* **Important Components:** `Card`, `Input`, `Button`, `DialogModal`.
* **Primary Actions:** Select amount, apply promo code, generate QRIS, verify payment.
* **Navigation Relationships:** Links to `/dashboard/billing` for invoice history.
* **Empty / Loading / Error States:** *Loading:* Button spinner while creating invoice; *Empty:* Default preset amount pre-selected; *Error:* Expired/failed invoice banner with `Generate New QR Code` button.

#### U7. Billing / Transactions History (`/dashboard/billing`) — *[MVP]*
* **Purpose:** Display a chronological ledger of all credit top-ups and invoices.
* **Main Content:** Filter by status (`All`, `PAID`, `PENDING`, `EXPIRED`) + Transactions Table (`Invoice ID`, `Created At`, `Description`, `AmountCredited`, `Total Paid`, `Status Badge`, `Action: Resume QRIS / View Receipt`).
* **Important Components:** `DataTable`, `Badge`, `DialogModal (Printable Receipt)`.
* **Primary Actions:** `Resume Pending Payment`, `View/Print Receipt`.
* **Navigation Relationships:** Linked from `/dashboard/credits`.
* **Empty / Loading / Error States:** *Loading:* 5 skeleton rows; *Empty:* `No billing transactions yet` + `+ Top Up Credits`; *Error:* Retry banner.

#### U8. Interactive API Playground (`/dashboard/playground`) — *[MVP]*
* **Purpose:** Allow developers to test models and verify API key execution directly in the browser.
* **Main Content:**
  * **Left Parameter Rail (`260px`):** Model selector, API Key selector, System Prompt, `Temperature`, `Max Tokens`, and `Stream` toggle.
  * **Center Prompt & Output Canvas (`flex-1`):** Message history (with collapsible `Reasoning / Thinking` block when returned by model) and bottom prompt composer (`⌘+Enter` to send).
  * **Right Telemetry & Code Pane (`320px`):** Tabs for `Usage & Cost Receipt` (`prompt_tokens`, `cached_tokens`, `completion_tokens`, latency `ms`, cost deducted), `Raw Response JSON`, and `Equivalent cURL / SDK Code`.
* **Important Components:** `Select`, `Input`, `CodeBlock`, `SegmentedTabs`.
* **Primary Actions:** `Send Request (⌘+Enter)`, `Copy cURL`, `Clear Session`.
* **Navigation Relationships:** Pre-filled when launched from `/models`.
* **Empty / Loading / Error States:** *Loading:* Streaming indicator + elapsed timer; *Empty:* Starter prompt suggestions; *Error:* Exact HTTP error JSON card (e.g., `401 Unauthorized` or `402 Insufficient Balance`).

#### U10. Account Settings (`/dashboard/settings`) — *[MVP]*
* **Purpose:** Manage account security and notification thresholds.
* **Main Content:** Stacked cards (`max-w-2xl`) for Profile/Email info, Password update form, and Low-Balance Email Alert threshold input.
* **Important Components:** `Card`, `Input`, `Button`.
* **Primary Actions:** `Save Settings`, `Update Password`.
* **Navigation Relationships:** Accessible from sidebar footer.
* **Empty / Loading / Error States:** *Loading:* Form skeleton; *Empty:* N/A; *Error:* Field validation messages.

### 8.3 Admin Panel Specifications

#### A1. Admin Overview (`/admin`) — *[MVP]*
* **Purpose:** High-level operational and financial summary for platform administrators.
* **Main Content:** 4 KPI Cards (`24h Gross Top-Ups`, `24h Token Revenue`, `24h Upstream Cost Estimate`, `Global Error Rate %`), Upstream Master Balance warning list, and 24h Traffic/Error chart.
* **Important Components:** `Card`, `ChartContainer`, `DataTable`.
* **Primary Actions:** Inspect degraded upstreams, navigate to routing/pricing controls.
* **Navigation Relationships:** Hub linking to `/admin/providers`, `/admin/routing`, `/admin/pricing`, `/admin/users`.
* **Empty / Loading / Error States:** *Loading*, *Empty*, *Error*.

#### A2. User Management (`/admin/users`) — *[MVP]*
* **Purpose:** Search accounts, inspect user balances/keys, and perform audited balance adjustments or suspensions.
* **Main Content:** Search bar + Users Table (`Email`, `User ID`, `Wallet Balance`, `Total Spend`, `Active Keys`, `Status`, `Actions`) + `UserDetailDrawer` with manual credit/debit form (requiring an audit reason).
* **Important Components:** `DataTable`, `SlideOverDrawer`, `DialogModal`.
* **Primary Actions:** `Search User`, `Adjust Balance`, `Suspend/Unsuspend User`.
* **Navigation Relationships:** Links to `/admin/requests?user_id=...` *(Phase 2)*.
* **Empty / Loading / Error States:** *Loading*, *Empty*, *Error*.

#### A3. Model Management (`/admin/models`) — *[MVP]*
* **Purpose:** Create and configure canonical models exposed in the gateway catalog.
* **Main Content:** Models Table (`Display Name`, `Canonical Slug`, `Context / Max Out`, `Capabilities`, `Pool/Tier Label`, `Status: Public / Hidden / Maintenance`, `Actions`) + `AddEditModelDrawer`.
* **Important Components:** `DataTable`, `SlideOverDrawer`, `Input`, `Badge`.
* **Primary Actions:** `+ Add Model`, `Edit Model Metadata`, `Toggle Maintenance Status`.
* **Navigation Relationships:** Links to `/admin/routing` and `/admin/pricing`.
* **Empty / Loading / Error States:** *Loading*, *Empty*, *Error*.

#### A4. Upstream Providers (`/admin/providers`) & A5. Provider Credentials (`/admin/credentials`) — *[MVP]*
* **Purpose:** Register upstream inference endpoints and manage encrypted upstream API keys.
* **Main Content:**
  * `/admin/providers`: Table of upstream suppliers (`Provider Name`, `Base URL`, `Timeout ms`, `Active Keys Count`, `Health Status`, `Actions`).
  * `/admin/credentials`: Table of master keys grouped by provider (`Label`, `Masked KeyPrefix`, `Concurrency Limit`, `Weight`, `Status: Active / Cooldown / Disabled`, `Actions: Rotate / Test Ping / Delete`).
* **Important Components:** `DataTable`, `DialogModal`, `Badge`, `Button`.
* **Primary Actions:** `+ Add Provider`, `+ Add Encrypted Credential`, `Test Upstream Ping`, `Disable/Enable Key`.
* **Navigation Relationships:** Feeds into `/admin/routing`.
* **Empty / Loading / Error States:** *Loading*, *Empty*, *Error*.

#### A6. Routing Configuration (`/admin/routing`) — *[MVP]*
* **Purpose:** Map each canonical model slug to an ordered priority chain of upstream providers and define failover behavior.
* **Main Content:** Split-pane view: Left list of canonical models (`300px`); Right inspector (`flex-1`) displaying the ordered upstream target list (`Priority 1`, `Priority 2`, `Fallback 3`), load-balancing weight inputs, timeout threshold (`ms`), and retry status codes (`429, 500, 502, 503, 504`).
* **Important Components:** `DataTable`, `Card`, `Input`, `Select`, `Button`.
* **Primary Actions:** `Add Upstream Target to Model`, `Reorder Priority`, `Save Routing Rules`.
* **Navigation Relationships:** Connects `/admin/models` and `/admin/providers`.
* **Empty / Loading / Error States:** *Loading*, *Empty* (`Select a model from the left list`), *Error*.

#### A7. Pricing & Multipliers (`/admin/pricing`) — *[MVP]*
* **Purpose:** Configure customer-facing token prices relative to upstream baseline costs.
* **Main Content:** Global FX reference bar + Pricing Table (`Model Slug`, `Upstream Cost $/1M In/Out/Cache`, `Pricing Mode: Multiplier / Gross Margin % / Fixed Override`, `Customer Price In/Out/Cache`, `Calculated Margin %`, `Save`).
* **Important Components:** `DataTable`, `Input`, `Badge`, `Button`.
* **Primary Actions:** Edit model multiplier/price, preview margin percentage, publish updated pricing.
* **Navigation Relationships:** Updates public `/models` and `/pricing` views.
* **Empty / Loading / Error States:** *Loading*, *Empty*, *Error*.

#### A8. Request Monitoring (`/admin/requests`), A9. Revenue Analytics (`/admin/revenue`), A10. System Health (`/admin/health`), A11. Audit Logs (`/admin/audit-logs`), & A12. Platform Settings (`/admin/settings`) — *[A12: MVP | A8, A9, A10: Phase 2 | A11: Phase 3]*
* **A12. Platform Settings (MVP):** Form panels for configuring payment gateway webhook credentials, minimum top-up bounds, and global announcement banners.
* **A8. Request Monitoring (Phase 2):** Global filterable request log table showing selected upstream provider, failover hops, upstream cost, and customer charge.
* **A9. Revenue Analytics (Phase 2):** Daily/monthly revenue vs upstream COGS charts and margin breakdown by model.
* **A10. System Health (Phase 2):** Database, Redis, and upstream circuit-breaker status dashboard.
* **A11. Audit Logs (Phase 3):** Chronological table of admin configuration changes with JSON before/after inspection drawer.

## 9. Key User Experience Flows

All 12 core user and administrator flows are designed to minimize clicks and avoid unnecessary page transitions:

1. **New User Registration (`3 Clicks`):** Click `Get API Key` in header $\rightarrow$ click `Continue with Google` (or submit Email + Password) on `/register` $\rightarrow$ land directly on `/dashboard` with the Quickstart Checklist active.
2. **Adding Credits (`3 Steps`):** Click `+ Top Up Credits` in header/sidebar $\rightarrow$ select preset amount on `/dashboard/credits` and click `Generate QRIS` $\rightarrow$ scan QR code in `DynamicQrisModal`; webhook auto-transitions modal to `Payment Verified!` and updates header balance without page reload.
3. **Creating an API Key (`2 Clicks`):** On `/dashboard/keys`, click `+ Create New API Key` $\rightarrow$ type label (`Cursor IDE`) and press `Enter` $\rightarrow$ copy the raw `sk-ktl-...` string from `OneTimeKeyRevealModal`.
4. **Finding an AI Model (`Instant`):** Press `⌘K` anywhere (or filter on `/models`) $\rightarrow$ type model or capability name $\rightarrow$ click the monospace model slug pill to copy it to clipboard.
5. **Viewing & Estimating Model Pricing:** On `/models` or `/pricing`, toggle currency (`IDR` / `USD`), sort columns by `Input`, `Cached Input`, or `Output`, and enter token volumes in the inline calculator to see exact cost estimates.
6. **Making the First API Request:** Click `Try in Playground` on any model row $\rightarrow$ select an active API key on `/dashboard/playground` and press `⌘+Enter` to test live streaming in-browser, or click `Copy cURL / SDK Snippet` to run locally in terminal/IDE.
7. **Monitoring Token Consumption:** Open `/dashboard/analytics` $\rightarrow$ filter by date window (`7d` / `30d`), API Key, or Model $\rightarrow$ inspect stacked chart of Uncached Input, Cached Input, and Output tokens $\rightarrow$ click `Export CSV`.
8. **Reviewing Request Logs:** Open `/dashboard/logs` $\rightarrow$ filter by HTTP status (`429` or `502`) or API key $\rightarrow$ inspect timestamp, latency (`ms`), token count, and status message for each call.
9. **Managing API Keys:** On `/dashboard/keys`, click `Edit Limit` on any row to set or update a spending cap in real time, `Pause` to temporarily block traffic, or `Revoke` (with confirmation modal) to permanently invalidate the key hash.
10. **Admin Adding a New Upstream Provider:** On `/admin/providers`, click `+ Add Provider` (enter name & base URL) $\rightarrow$ open `/admin/credentials`, click `+ Add Key` (paste master secret, set concurrency cap) $\rightarrow$ click `Test Ping` to verify `200 OK` connectivity.
11. **Admin Configuring Model Routing:** On `/admin/routing`, select a canonical model slug on the left $\rightarrow$ add/reorder upstream providers in the priority chain, set timeout/failover rules on the right $\rightarrow$ click `Save Routing Rules`.
12. **Admin Changing Model Pricing:** On `/admin/pricing`, edit the upstream cost baseline or target margin/multiplier on a model row $\rightarrow$ verify the live-calculated customer price and margin badge $\rightarrow$ click `Publish Pricing`.

## 10. Domain-Specific UI Details

* **Model Catalog Precision & Transparency:** Every model row displays `Provider`, `Model Name`, copyable `API Slug`, `Context Length`, `Max Output`, `Input Price`, `Cached Input Price`, `Output Price`, and capability/precision badges (`Vision`, `Tools`, `Reasoning`, `FP8` / `NVFP4` when known).
* **API Key Security & Masking:** Full `sk-ktl-...` keys are displayed **only once** inside `OneTimeKeyRevealModal` immediately upon creation. All subsequent table renders, logs, and analytics display only the non-sensitive prefix (`sk-ktl-9f8a...`).
* **Three-Way Token Metering Display:** Usage Analytics, Request Logs, and Playground receipts always separate `Uncached Input`, `Cached Input`, and `Output` tokens so developers can verify prompt-caching efficiency.
* **Admin Upstream & Pricing Clarity:** Admin views display upstream health states (`Healthy`, `Degraded`, `Circuit Open`) and show both **Upstream Cost** and **Customer Price** side-by-side so operators never publish negative-margin rates accidentally.

## 11. Responsive Behavior

| Breakpoint Tier | Navigation Layout | KPI Cards | Data Tables (`Models`, `Keys`, `Logs`) | Multi-Pane Views (`Playground`, `Docs`, `Routing`) |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop (`≥1280px`)** | Persistent `240px` left sidebar + `56px` top bar. | 4-column grid (`gap-4`). | Full table with all columns visible; slide-over drawers (`420px`) open on right. | 3-pane horizontal layout (Config Rail + Center Canvas + Right Inspector). |
| **Laptop (`1024px–1279px`)** | Persistent `220px` left sidebar + `56px` top bar. | 4-column grid (`gap-3`). | Full table visible; right inspector overlays right side of viewport. | 2-pane horizontal layout; code/JSON pane collapses into tabs. |
| **Tablet (`768px–1023px`)** | Collapsible `60px` icon rail + `56px` top bar. | 2×2 grid (`gap-3`). | Horizontal scroll (`overflow-x-auto`) with sticky first column (`Model` / `Key Name`). | Stacked vertical panels or segmented top tabs. |
| **Mobile (`<768px`)** | Top bar with hamburger button opening off-canvas drawer. | 1-column or 2×2 compact grid (`gap-2.5`). | Horizontal scroll wrapper (`overflow-x-auto`); primary actions remain tap-friendly (`min-h-[36px]`). | Segmented 3-tab bar at top (`Parameters` \| `Prompt` \| `Receipt/JSON`). |

## 12. Accessibility Guidelines

1. **Mathematically Verified Contrast:** All body copy, table headers, and badge labels use the verified AA text tokens in Section 3.3 (`≥ 4.50:1` contrast against both `#FAF9F5` and `#F0EEE8` in Light Mode, and `≥ 4.75:1` against `#1A1A17` and `#0D0D0C` in Dark Mode). Primary text (`#282824` on `#FAF9F5`) achieves **14.05:1 (WCAG AAA)**.
2. **Color-Independent Indicators:** Status badges always combine color with explicit text or shape prefixes (`● 200 OK`, `▲ 429 Limit`, `✕ 502 Error`).
3. **Keyboard Navigation & Focus Trapping:** Every interactive element displays a visible `2px` focus ring (`focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]`). Modals and drawers trap `Tab` focus and close on `Escape`.
4. **Semantic Markup & Screen Readers:** Tables use proper `<th scope="col">` and `aria-sort` attributes; dynamic copy confirmations and payment webhook updates announce via `role="status" aria-live="polite"`.

## 13. Interaction, Animation & Implementation Guidelines

* **Snappy Micro-Interactions:** Limit transitions to `120ms` for hover/color states and `180ms cubic-bezier(0.16, 1, 0.3, 1)` for modals and drawers. Honor `@media (prefers-reduced-motion: reduce)`.
* **CSS Custom Properties First:** Implement all colors in `apps/web/src/styles/theme.css` under `:root` (Warm Editorial Light default) and `.dark` (Obsidian Carbon Dark), mapped to semantic Tailwind utility classes (`bg-primary`, `bg-secondary`, `bg-surface`, `text-primary`, `text-secondary-aa`, `border-default`, `text-accent-text`, `text-success-text`, `text-warning-text`, `text-error-text`).
* **Zero Hardcoded Business Constants in UI:** Components must read brand title, base API URL, model catalog, pricing tiers, and billing options from configuration/API props so business changes never require redesigning UI components.

## 14. Design Anti-Patterns to Avoid

1. **No Purple/Blue/Neon AI Gradients:** Never use `bg-gradient-to-r` with indigo, purple, or neon cyan anywhere in the interface.
2. **No Decorative Icon Spam:** Never place `Sparkles`, `Rocket`, `Bot`, or `Brain` icons next to section headers.
3. **No Marketing Hero Inside Authenticated Views:** `/dashboard` and `/admin` must open directly into functional telemetry and management workspaces.
4. **No Bloated Cards for Tabular Data:** Never replace the compact Model Catalog or API Keys table with large multi-row card grids.
5. **No Proportional Numerals in Data Columns:** Never render prices, token counts, latencies, or timers without `font-mono tabular-nums`.
6. **No Unbounded Chart Canvases:** Never render a Chart.js `<canvas>` outside a fixed-height container (`h-64`) with `maintainAspectRatio: false`.
7. **No Native Browser Dialogs:** Never call `alert()`, `confirm()`, or `prompt()`; always use `DialogModal` or `Toast`.
8. **No Raw Brand Accent Text on Light Backgrounds:** Never use raw `#B77A45` (3.39:1), `#C88A32` (2.79:1), or `#C45E52` (3.93:1) for small `10px–13px` text on `#FAF9F5` or `#F0EEE8`; always use their verified AA text companions (`#8F5B2D`, `#8C5E1A`, `#A33E32`).
9. **No Unbacked SLA or Fake Telemetry Badges:** Never hardcode static claims like `99.94% Uptime` or fake live counters when real backend metrics are not connected.
10. **No Re-Displaying Full API Keys:** Never show or return the full `sk-ktl-...` secret after `OneTimeKeyRevealModal` is closed.
