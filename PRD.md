# Product Requirements Document (PRD)

## ComfyUI Workflow Hub — Version 1

**Document version:** 1.0  
**Last updated:** 2026-03-28  
**Status:** Draft for implementation

---

## 1. Overview and goals

### 1.1 Problem

There are relatively few curated places to discover **ready-made ComfyUI workflows**. Users who already work with ComfyUI often want **reproducible, documented graphs** without building everything from scratch.

### 1.2 Product vision

A **web aggregator** that connects **consumers** of workflows with **creators** (creators are first-class in the long term; **v1 is admin-curated**). The site emphasizes **search**, **structured metadata**, **ratings and reviews**, and **transparent download metrics**.

### 1.3 Goals for v1

| Goal | Description |
|------|-------------|
| Discovery | Users find relevant workflows quickly via search, filters, and sort. |
| Trust | Ratings, review counts, and download counts support decision-making. |
| Low friction | Guests can browse and download free workflows; OAuth for contributors of reviews. |
| Quality control | All published workflows are ingested via **admin** with internal moderation. |

### 1.4 Success metrics (indicative)

- Catalog size (published workflows).
- **Unique** downloads per workflow and globally.
- Active reviewers and reviews per workflow.
- Time-to-find (qualitative / session analytics via server logs and admin tools in v1 — no third-party analytics).

---

## 2. Target audience

### 2.1 Consumers

Users who **have already used ComfyUI** and are looking for **ready-made solutions**. They are not complete beginners, but may not build complex graphs from scratch.

### 2.2 Creators (long-term)

Experienced workflow authors who need a **convenient publishing surface** and (later) monetization. **v1:** creators do not self-publish; the team publishes on their behalf via admin.

### 2.3 Administrators

Internal operators who upload JSON, attach metadata and media, adjust derived node lists, and moderate reviews.

---

## 3. Scope

### 3.1 In scope (v1)

- Public **catalog** with **search and filters** (tags, base model, ComfyUI version).
- **Sort / filter** by **average user rating** and **unique download count** (minimum: sorting; optional follow-up: minimum rating threshold filter).
- **Workflow detail page** with description, metadata, and **full list of nodes** (auto-parsed from JSON + admin override).
- **Download** of **free** workflow files (**JSON only** in object storage).
- **Guest** catalog browsing and **guest downloads** (no login required to download).
- **OAuth** sign-in: **Google** and **GitHub** (no email/password in v1).
- **Reviews**: authenticated users only; **must have downloaded** the workflow before submitting a review; stars **1–5**, text **optional**; user may **edit or delete** own review; **admin may delete** any review.
- **Download counting**: public metric = **unique downloaders**; admin sees **raw request/hit** data for diagnostics.
- **Admin panel** for CRUD workflows, file upload, media, moderation.
- **Detail-page media only** (not in catalog list): input/output **example images** and optional **example videos** (see section 5).

### 3.2 Out of scope (v1)

- Paid workflows, checkout, payouts, seller dashboards.
- Self-serve author registration and publishing.
- Preview thumbnails in the **catalog list** (dense, text-first listing).
- Bundling custom nodes, models, or archives with the workflow artifact.
- Third-party analytics (GA, etc.) — **none** in v1; server logs + admin metrics only.

---

## 4. Key user journeys

### 4.1 Guest

1. Open site → browse or search/filter workflows.  
2. Open workflow detail → read metadata, nodes, optional input/output examples.  
3. Download JSON (no login).  
4. Optionally sign in later to leave a review **after** a qualifying download (as authenticated user).

### 4.2 Authenticated user

1. Sign in with Google or GitHub.  
2. Download workflow (if not already counted, contributes to **unique** download metric).  
3. Submit **1–5 star** review with optional text; edit or delete own review.

### 4.3 Admin

1. Create/edit workflow record: title, slug, description, tags, base model, ComfyUI version, status (draft/published).  
2. Upload/replace **workflow JSON**; system parses **node list**; admin can **override/supplement** nodes.  
3. Upload **media** for input/output example blocks within limits.  
4. Moderate reviews (delete inappropriate entries).

---

## 5. Functional requirements and acceptance criteria

### 5.1 Catalog and search

**Requirements**

- Paginated (or infinite) list of **published** workflows.
- **No images** in list rows (text + key metadata only).
- Full-text or keyword search over title, description (implementation choice — document in Technical Considerations).
- **Filters:** tags (multi), base model, ComfyUI version.
- **Sort:** at least by **average rating**, **unique downloads**, **recency** (published/updated date).

**Acceptance criteria**

- Given published workflows with varied metadata, a user can filter by each facet and see only matching rows.
- Sorting by rating and unique downloads matches stored aggregates (see data model).
- Unpublished/draft workflows never appear in the public catalog.

**Technical considerations**

- Denormalize `average_rating`, `review_count`, `unique_download_count` on `Workflow` (or materialized view) for performant sort/filter; update on review/download events.

---

### 5.2 Workflow detail page

**Requirements**

- Show title, description, tags, base model, ComfyUI version, author display name (admin-defined string in v1 if no linked author user).
- Show **complete node list** (union of parsed + admin-edited list; admin override wins for display order or exclusions — product rule: **display list = admin final list if set, else derived**; see algorithm below).
- Show **aggregate rating** and **review list** (with pagination).
- Show **unique download count** (public).
- **Example media** (optional):
  - **Input block:** up to **5** images and/or **0 or 1** video; may be empty.
  - **Output block:** up to **5** images and/or **0 or 1** video; may be empty.

**Node list algorithm (conceptual)**

1. On JSON upload, parse graph and extract unique node type identifiers (implementation maps ComfyUI JSON shape to stable strings, e.g. class type / node name).  
2. Store `derived_nodes[]`.  
3. If `admin_nodes[]` is non-empty, **detail page displays `admin_nodes`** (full replacement) OR **merge policy** — **v1 recommendation:** admin **replaces** display list when they save overrides; empty admin override means “use derived only.” Document chosen rule in implementation spec.

**Acceptance criteria**

- Replacing JSON re-triggers parse; admin sees updated derived list unless override locks it (clarify in implementation: either “clear override on new JSON” or “keep override until admin resets” — **default recommendation:** on new JSON upload, **reset admin override** to derived to avoid stale data; admin may re-edit.)

---

### 5.3 Download and metrics

**Requirements**

- **Guests** may download published free workflows.
- **Public counter:** **unique downloaders** per workflow.
- **Authenticated users:** at most **one** increment per `(user_id, workflow_id)` lifetime (repeat downloads do not increase public counter).
- **Anonymous users:** assign or read long-lived first-party cookie `anon_device_id` (UUID); count at most one unique anonymous downloader per `(workflow_id, anon_device_id)`.
- **Anti-abuse (light):** per IP, cap **new** anonymous device tokens that can register a **first** unique download per workflow per time window (tunable constants below).
- **Admin:** raw download requests logged (IP hash, timestamp, workflow id, user id if any, anon cookie id, outcome) for diagnostics.

**Acceptance criteria**

- Public number never exceeds logical unique keys (users + anon devices).
- Repeat downloads by same logged-in user do not change public unique count.
- Admin can inspect raw volume spikes vs unique metric.

**Technical considerations**

- Use **signed URLs** or proxied download endpoint with checks; avoid permanent public buckets for workflow JSON.
- Rate-limit download endpoint per IP and per account.

---

### 5.4 Reviews

**Requirements**

- Only **authenticated** users may create/update/delete their review.
- User may review only if they have a **recorded qualifying download** for that workflow **as that user** (download while logged in). *Note:* guests who download without login cannot review until they sign in **and** download again while authenticated — **product alternative:** “verified purchase/download” flag only for logged-in path in v1; document clearly in UX (“Sign in and download to review”).

- Stars: integer **1–5** (required).
- Text: optional string; sanitize HTML; max length (tunable, e.g. 2000 chars).
- User can **edit** or **delete** own review.
- **Admin** can **delete** any review (soft-delete recommended for audit).

**Acceptance criteria**

- API rejects review create without prior qualifying authenticated download.
- One review per `(user_id, workflow_id)` — updates replace same record.
- Deleting review updates aggregates.

**Technical considerations**

- Recalculate `average_rating` and `review_count` transactionally on write.

---

### 5.5 Admin and workflow artifact

**Requirements**

- Store **only** workflow **JSON** as the downloadable artifact (no custom node bundles or checkpoints).
- Admin can set workflow **status**: draft / published / archived (exact names tunable).
- Validate JSON structure as “parseable ComfyUI workflow” (best-effort schema check); reject garbage files.

**Acceptance criteria**

- Published workflows always have a stored JSON object and successful parse for node extraction (or explicit admin bypass with warning — **default:** no bypass).

---

### 5.6 Media uploads (detail page)

**Requirements**

- Store images and videos in **S3-compatible object storage** (or equivalent).
- **Tunable default limits** (see section 8):

| Asset type | Default max per file | Default max count |
|------------|----------------------|-------------------|
| Example image | 3 MB | 5 per Input block, 5 per Output block |
| Example video | 12 MB | 1 per Input block, 1 per Output block |

- Validate MIME types (allowlist: e.g. `image/jpeg`, `image/png`, `image/webp`; `video/mp4`, `video/webm`).
- Serve via CDN or signed URLs; lazy-load video in UI.

**Acceptance criteria**

- Uploads above limits rejected with clear error.
- Catalog list remains image-free; media appears only on detail page.

---

### 5.7 Authentication

**Requirements**

- OAuth 2.0 with **Google** and **GitHub**.
- Session management via industry-standard approach (e.g. HTTP-only cookies with secure flags) — implementation detail.
- No email/password registration in v1.

**Acceptance criteria**

- User can sign in with either provider and maintain session across browser restarts until expiry.
- Admin users flagged via `role` or allowlist.

---

### 5.8 Localization

- **UI copy:** **English only** in v1.
- **User-generated content** (descriptions, tags, reviews) may be **any language** unless moderation policy adds “English-only descriptions” later.

---

## 6. Conceptual data model

Entities and fields are logical names for engineering alignment (not SQL prescriptive).

### 6.1 `User`

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | Primary key |
| `provider` | enum | `google`, `github` |
| `provider_subject` | string | Unique per provider |
| `email` | string | Nullable if provider omits |
| `display_name` | string | From provider or default |
| `role` | enum | `user`, `admin` |
| `created_at` | datetime | |

**Constraints:** unique `(provider, provider_subject)`.

---

### 6.2 `Workflow`

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | |
| `slug` | string | Unique, URL-safe |
| `title` | string | |
| `description` | text | Markdown subset or plain — decide in implementation |
| `status` | enum | `draft`, `published`, `archived` |
| `base_model` | string | e.g. SDXL, Flux — controlled vocabulary recommended |
| `comfy_version` | string | Min/required version label |
| `author_display_name` | string | v1 admin-set |
| `unique_download_count` | int | Denormalized |
| `average_rating` | decimal(3,2) | Denormalized |
| `review_count` | int | Denormalized |
| `created_at` / `updated_at` | datetime | |
| `published_at` | datetime | Nullable |

---

### 6.3 `WorkflowFile`

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | |
| `workflow_id` | FK | |
| `storage_key` | string | Object storage path |
| `content_type` | string | `application/json` |
| `byte_size` | int | |
| `sha256` | string | Optional integrity |
| `uploaded_at` | datetime | |

---

### 6.4 `WorkflowNode` (display list)

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | |
| `workflow_id` | FK | |
| `node_type` | string | Display string |
| `sort_order` | int | |
| `source` | enum | `derived`, `admin` |

**v1 simplification:** store final ordered list after each parse/admin save.

---

### 6.5 `Tag` and `WorkflowTag`

- `Tag`: `id`, `slug`, `name`.  
- `WorkflowTag`: `(workflow_id, tag_id)` unique.

---

### 6.6 `DownloadEvent` (raw)

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | |
| `workflow_id` | FK | |
| `user_id` | FK nullable | Set if authenticated |
| `anon_device_id` | string nullable | From cookie |
| `ip_hash` | string | Hashed IP + rotating salt |
| `occurred_at` | datetime | |
| `counted_unique` | bool | Whether this event incremented public counter |

---

### 6.7 `UniqueDownload` (materialized fact)

| Field | Type | Notes |
|-------|------|--------|
| `workflow_id` | FK | |
| `user_id` | FK nullable | XOR with anon key |
| `anon_device_id` | string nullable | |
| `first_at` | datetime | |

**Constraint:** unique `(workflow_id, user_id)` where user not null; unique `(workflow_id, anon_device_id)` where anon not null.

---

### 6.8 `Review`

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | |
| `workflow_id` | FK | |
| `user_id` | FK | |
| `rating` | int | 1–5 |
| `body` | text nullable | |
| `created_at` / `updated_at` | datetime | |
| `deleted_at` | datetime nullable | Soft delete for admin/moderation |

**Constraint:** unique `(workflow_id, user_id)` among non-deleted rows.

---

### 6.9 `MediaAsset`

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | |
| `workflow_id` | FK | |
| `kind` | enum | `image`, `video` |
| `role` | enum | `input_example`, `output_example` |
| `storage_key` | string | |
| `byte_size` | int | |
| `mime_type` | string | |
| `sort_order` | int | For images within role |

**Constraints:** enforce max counts per `(workflow_id, role, kind)` in application layer.

---

### 6.10 `AdminAuditLog` (recommended)

| Field | Type | Notes |
|-------|------|--------|
| `id` | UUID | |
| `admin_user_id` | FK | |
| `action` | string | |
| `entity_type` | string | |
| `entity_id` | UUID | |
| `payload_json` | json | Redact secrets |
| `created_at` | datetime | |

---

## 7. Recommended technical stack

High-level only; final choice belongs to the team.

| Layer | Recommendation | Rationale |
|-------|----------------|-----------|
| Web app | **Next.js** (or similar SSR framework) | SEO for public catalog pages, server components/API routes |
| Database | **PostgreSQL** | Relational integrity, filters, aggregates |
| Object storage | **S3-compatible** (AWS S3, R2, MinIO) | JSON + media blobs |
| Auth | OAuth via **Google** / **GitHub** | Aligns with v1 requirements |
| Hosting | Managed platform (Vercel, Fly.io, Railway, etc.) | Operational simplicity for v1 |

**Documentation references (external)**

- [OAuth 2.0](https://oauth.net/2/) — authorization framework  
- [OpenID Connect](https://openid.net/connect/) — identity layer on OAuth  
- [AWS S3](https://docs.aws.amazon.com/s3/) or [Cloudflare R2](https://developers.cloudflare.com/r2/) — object storage  
- [Next.js Documentation](https://nextjs.org/docs) — if Next.js is chosen  

---

## 8. Tunable configuration defaults

All values **must be environment-configurable** without code change.

| Key | Default | Purpose |
|-----|---------|---------|
| `MEDIA_IMAGE_MAX_MB` | 3 | Per image upload |
| `MEDIA_VIDEO_MAX_MB` | 12 | Per video upload |
| `ANON_COOKIE_TTL_DAYS` | 365 | `anon_device_id` persistence |
| `ANON_NEW_DEVICE_PER_IP_PER_WORKFLOW_HOUR` | 10 | Soft cap on distinct anon devices registering a first unique download per workflow from one IP per hour |
| `DOWNLOAD_RATE_LIMIT_PER_IP_PER_MIN` | 30 | Burst protection |
| `REVIEW_BODY_MAX_CHARS` | 2000 | Review text |

**Note:** IP-based limits are coarse (NAT, mobile carriers). Pair with cookie-based uniqueness for the public metric.

---

## 9. UI/UX principles

- **Catalog:** dense, scannable rows; typography and spacing over imagery; show rating, downloads, tags, base model, Comfy version at a glance.
- **Detail:** clear sections — Overview, Requirements (Comfy version, base model), Nodes, Examples (Input / Output), Reviews, Download CTA.
- **Video:** lazy load; provide static poster where possible; do not autoplay with sound.
- **Accessibility:** keyboard-navigable lists, sufficient contrast, labeled form controls for reviews.

---

## 10. Security and privacy

- **Transport:** HTTPS everywhere.
- **Cookies:** `Secure`, `SameSite=Lax` (or `Strict` if compatible with OAuth return paths).
- **Downloads:** short-lived **signed URLs** or authenticated proxy; no world-readable buckets for workflow JSON.
- **Input validation:** strict allowlist for uploads; virus scanning optional future.
- **Reviews:** HTML escaping / sanitization; rate-limit review writes per user.
- **Logs:** hash IPs for raw download logs; minimize PII retention; document retention in privacy policy.
- **Privacy policy:** disclose OAuth identities, functional cookies (`anon_device_id`, session), and admin visibility into raw logs.

---

## 11. Milestones (suggested)

| Milestone | Deliverables |
|-----------|----------------|
| **M1** | DB schema, admin auth, workflow CRUD, JSON upload, node parsing pipeline |
| **M2** | Public catalog, search, filters, sort, workflow detail (without media) |
| **M3** | Download endpoint, unique counting (auth + anon), admin raw logs view |
| **M4** | Reviews (gated on authenticated download), aggregates, admin moderation |
| **M5** | Media uploads for examples, CDN/signed URLs, hardening, rate limits |

---

## 12. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Download/review manipulation | Unique keys, soft IP caps, rate limits, admin visibility into raw vs unique |
| Stale node list after JSON change | Reset admin override on new JSON (recommended) or explicit “re-sync” action |
| Mixed-language content | EN UI; optional moderation guidelines for descriptions |
| Legal / licensing of workflows | ToS, DMCA / takedown process, disclaimers — **require legal review** |
| Storage cost growth | Tunable media limits; periodic admin audit; future external URL option |
| OAuth provider outages | Clear error messaging; optional future second provider already in scope |

---

## 13. Future extensions

- **Paid workflows:** Stripe (or regional equivalent), entitlements, seller onboarding, revenue share.
- **Self-serve publishing** for verified authors; optional **premoderation** queue.
- **i18n** for UI strings.
- **Catalog thumbnails** (optional user setting).
- **Filter/search by nodes** (indexed node types).
- **Third-party analytics** with consent banner if required by jurisdiction.
- **Email/password** or magic link as additional auth factors.

---

## 14. Open decisions for engineering spike

1. **Resolved (v1):** Catalog keyword search uses **case-insensitive substring match** on `workflows.title` and `workflows.description` via Prisma (`contains` + `insensitive` mode on PostgreSQL, equivalent to parameterized `ILIKE '%q%'`). No `tsvector`/GIN and no external search engine for v1. Public API: optional query parameter **`q`** on `GET /api/workflows` — omitted or whitespace-only after trim applies **no** text filter (full published list under pagination); non-empty `q` restricts to published rows matching title or description.  
2. **Resolved (v1):** Catalog filters (PRD §5.1) on `GET /api/workflows`: repeatable **`tag`** by tag **slug**; workflow must satisfy **all** tags (**AND**). Optional **`base_model`** and **`comfy_version`** — exact match on stored columns (including **case-sensitive** match on PostgreSQL for typical string equality). Filters, including multiple `tag` values, combine with **`q`** by **AND**. **Unknown tag slug:** empty list (`total: 0`), not HTTP 404. Enforced limits: ≤20 `tag` params, slug length ≤100; `base_model` / `comfy_version` length ≤200; violations → **400** with `issues`. **Note:** This paragraph is the **baseline v1** contract. **Post-v1** catalog filter matching and catalog field typeahead are defined in **§14.7** (engineering tasks **TASK-040–042**); once those tasks are implemented, public API behavior follows §14.7 for the affected query parameters and the new suggestions endpoint.  
3. **Resolved (v1):** Catalog **sort** on `GET /api/workflows`: optional **`sort`** — `date` (default), `rating`, or `downloads`. Optional **`order`** — `desc` (default) or `asc`. **`sort=rating`** orders by denormalized `workflows.average_rating`; **`sort=downloads`** by `workflows.unique_download_count`; both use a stable secondary key `id` ascending. **`sort=date`:** primary `published_at` with **NULLS LAST** when `order=desc` and **NULLS FIRST** when `order=asc`; secondary `updated_at` in the same direction as `order`; then `id` ascending. Invalid `sort` / `order` → **400** with `issues`. Sorting by rating and downloads matches stored aggregates (PRD §5.1).  
4. Exact ComfyUI JSON parser strategy (support multiple export formats if needed).  
5. Whether guest download still sets `anon_device_id` on first visit vs first download attempt.  
6. Soft-delete vs hard-delete for admin-removed reviews in public API responses.  
7. **Resolved (post-v1, TASK-040–042):** Catalog **list filters** on `GET /api/workflows` and **typeahead** for the same facets. **TASK-040:** `tag` (by tag **slug** only), `base_model`, and `comfy_version` use **case-insensitive full-string equality** (same logical values as v1 §14.2, forgiving letter casing). **TASK-041:** those three dimensions switch to **case-insensitive substring** match (`contains` / `ILIKE`-equivalent): for each `tag=` parameter, the workflow must have a linked tag whose **slug OR name** contains the query substring (OR inside the tag predicate); multiple `tag=` parameters still combine with **AND**; `base_model` and `comfy_version` match if the stored column **contains** the substring, case-insensitively. Combination with **`q`** and other filters remains **AND**; existing query length limits and **400**/`issues` validation stay in force. **TASK-042:** public **`GET /api/catalog/suggestions`** (or equivalent path documented in README) with `kind` ∈ `tag` | `base_model` | `comfy_version` and **`q`** returns up to a capped number of suggestions (e.g. 20) whose display value **contains** `q`, case-insensitively. **Data sources:** existing **`Tag`** rows (preferably restricted to tags attached to at least one **published** workflow); **`base_model`** and **`comfy_version`** values from **DISTINCT** columns on **published** workflows only — **no new database tables are required** for TASK-042; optional future normalization into reference tables is out of scope unless added as a separate task. Catalog UI (`/catalog`) uses this endpoint for combobox-style suggestions while typing.

---

*End of PRD*
