# Capture-Manifest Specification v0.1 (Draft)

**Capture-Manifest — AI Capture Provenance Protocol**

> **Status:** Draft v0.1 — initial spec.
> Spun out from UACP per [ADR 0038](https://github.com/hn2/fusionlayer/blob/main/docs/decisions/0038-uacp-context-only-narrowing.md).
> Tracked in [hn2/capture-manifest#1](https://github.com/hn2/capture-manifest/issues/1).

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**,
**SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be
interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they appear in
all capitals.

Sections labelled **(informative)** are explanatory and do not contain normative
requirements. All other sections are normative.

---

## §1 — Purpose and Scope

A **Capture-Manifest** is a machine-readable provenance record for AI-captured material.
It answers the question: *where did this artifact come from, who captured it, when, under
what consent, and what was stripped before storage?*

Capture-Manifest is designed to be **regulator-legible**: every field maps to a
specific GDPR Article 13/14 disclosure requirement, a CCPA §1798.100 notice-at-collection
field, or an EU AI Act transparency obligation.

### What Capture-Manifest owns

- Source identification: URL, app, document id, vendor
- Capture agent: the software component that performed the capture, its version
- Capture timestamp
- Consent basis: the lawful basis for processing (GDPR Article 6 / CCPA)
- Applied redactions: which patterns matched, which spans were redacted
- Hash chain: cryptographic link between this manifest and the UACP artifact it describes
- Manifest signature

### What Capture-Manifest does NOT own

- The captured content itself (lives in a UACP artifact; the manifest references it by id)
- Consent capture UI (vendor-specific)
- Long-term consent revocation propagation (separate spec, future)
- Agent action descriptions (see [AAP](https://github.com/hn2/aap))
- Context routing or delivery (see [UACP](https://github.com/hn2/uacp))

### Why a separate protocol (informative)

Capture-Manifest targets a different audience than UACP: UACP targets AI vendors
(engineers), while Capture-Manifest targets compliance officers and regulators. Bundling
these concerns would slow adoption of context portability — most vendors want the latter
without committing to the former's compliance posture. Keeping them separate means a
vendor can implement Capture-Manifest for GDPR compliance independently of UACP adoption.

---

## §2 — Manifest Structure

A Capture-Manifest is a JSON document. The normative schema is `schema/capture-manifest.schema.json`.

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `manifest_version` | string | Always `"0.1"` in this spec version. |
| `id` | string | Unique identifier for this manifest. UUID v4 recommended. |
| `artifact_id` | string | The UACP artifact id this manifest describes. MUST match the `id` field of the referenced UACP artifact. |
| `artifact_hash` | string | Integrity link to the captured artifact. Format: `sha256:<hex>`. Computed over the artifact's canonical JSON representation (same algorithm as UACP signing). |
| `source` | object | Capture source identification (see §3). |
| `agent` | object | The capturing agent (see §4). |
| `captured_at` | string | ISO 8601 timestamp in UTC when capture occurred. |
| `consent` | object | Consent basis for processing (see §5). |
| `manifest_signature` | string | Integrity signature over this manifest. Format: `sha256:<hex>`. Field removed before hashing. |

### Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `redactions` | array | Applied redactions (see §6). Absent or empty = no redactions applied. |
| `prev_manifest_id` | string | Id of the previous manifest in the hash chain, if this is not the first capture. Enables chain verification. |
| `retention_policy` | object | Data retention schedule (see §7). |
| `tags` | array of string | Free-form labels. |

### Minimum manifest (JSON)

```json
{
  "manifest_version": "0.1",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "artifact_id": "b3f8a21c-4e72-4d9b-9c03-e1a2f5d8b6c9",
  "artifact_hash": "sha256:3a1c8b4f2d7e9...",
  "source": {
    "vendor": "cursor",
    "kind": "ide"
  },
  "agent": {
    "name": "fusionlayer-daemon",
    "version": "1.4.2"
  },
  "captured_at": "2026-05-21T10:30:00Z",
  "consent": {
    "basis": "legitimate_interest",
    "gdpr_article": "6(1)(f)"
  },
  "manifest_signature": "sha256:7f3c9a2b1e4d8..."
}
```

---

## §3 — Source Object

The `source` object identifies what was captured from.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vendor` | string | REQUIRED | The AI tool vendor slug (e.g., `cursor`, `claude-code`, `continue`, `jetbrains`). |
| `kind` | string | REQUIRED | Source kind: `ide`, `chat`, `api`, `mobile`, `cli`, `browser`. |
| `url` | string | optional | URL or URI of the source document, if applicable. |
| `document_id` | string | optional | Opaque document or session identifier in the vendor's system. |
| `session_id` | string | optional | Conversation or session identifier. |

---

## §4 — Agent Object

The `agent` object identifies the software that performed the capture.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | REQUIRED | Agent name (e.g., `fusionlayer-daemon`, `fusionlayer-vscode`). |
| `version` | string | REQUIRED | Semver version of the capturing agent. |
| `platform` | string | optional | OS/platform string (e.g., `darwin`, `win32`, `linux`). |
| `key_id` | string | optional | Public key identifier for verifying the manifest signature (see §8). |

---

## §5 — Consent Object

The `consent` object provides the lawful basis for processing the captured material.
It is designed to satisfy GDPR Article 13/14 and CCPA §1798.100 notice-at-collection
disclosure requirements.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `basis` | enum string | REQUIRED | Lawful basis: `explicit_consent`, `legitimate_interest`, `contract`, `legal_obligation`, `vital_interests`, `public_task`. Maps to GDPR Article 6(1)(a)–(f). |
| `gdpr_article` | string | optional | The specific GDPR Article 6 sub-clause (e.g., `"6(1)(a)"`, `"6(1)(f)"`). Informational. |
| `ccpa_category` | string | optional | CCPA personal information category (e.g., `"identifiers"`, `"professional_information"`). Informational. |
| `notice_url` | string | optional | URL to the full privacy notice shown to the user at the time of collection. |
| `user_id` | string | optional | Opaque identifier of the user who provided consent (DID-style or UUID). MUST NOT be PII. |
| `consented_at` | string | optional | ISO 8601 UTC timestamp when consent was given. |

### Consent basis values

| Value | GDPR Article | Meaning |
|-------|-------------|---------|
| `explicit_consent` | 6(1)(a) | User actively consented (opt-in). |
| `legitimate_interest` | 6(1)(f) | Processing is necessary for legitimate interests. A legitimate interests assessment (LIA) SHOULD be documented. |
| `contract` | 6(1)(b) | Processing is necessary to perform a contract with the data subject. |
| `legal_obligation` | 6(1)(c) | Processing is necessary for compliance with a legal obligation. |
| `vital_interests` | 6(1)(d) | Processing is necessary to protect someone's vital interests. |
| `public_task` | 6(1)(e) | Processing is necessary for a task carried out in the public interest. |

---

## §6 — Redactions Array

The `redactions` array documents patterns that were matched and spans that were removed
from the captured content before the artifact was stored.

Each entry in the array is an object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pattern_id` | string | REQUIRED | Identifier of the redaction pattern that matched (e.g., `pii:email`, `secret:api-key`). |
| `pattern_label` | string | optional | Human-readable label (e.g., `"Email address"`, `"API key"`). |
| `count` | integer ≥ 1 | REQUIRED | Number of spans removed. |
| `placeholder` | string | optional | Replacement text used (e.g., `"[REDACTED]"`, `"[EMAIL]"`). |

Implementations MUST include a redaction entry for every pattern that matched, even if
`count` is 1. The specific redacted text MUST NOT appear in the manifest.

---

## §7 — Retention Policy Object (optional)

The `retention_policy` object documents the data retention schedule.

| Field | Type | Description |
|-------|------|-------------|
| `delete_after_days` | integer | Number of days after `captured_at` before the artifact SHOULD be deleted. |
| `delete_reason` | string | Human-readable reason (e.g., `"User withdrawal request"`, `"Default 30-day retention"`). |
| `scheduled_delete_at` | string | ISO 8601 UTC timestamp of scheduled deletion. SHOULD be `captured_at + delete_after_days`. |

---

## §8 — Signing and Hash Chain

### Manifest signature

The `manifest_signature` field MUST be computed as follows:

1. Serialize the full manifest to canonical JSON (keys sorted lexicographically,
   no extra whitespace, same algorithm as UACP signing).
2. Remove the `manifest_signature` field from the serialized object.
3. Compute `sha256(<canonical-JSON-bytes>)` and encode as lowercase hexadecimal.
4. Set `manifest_signature: sha256:<hex>`.

### Artifact hash

The `artifact_hash` field MUST be a SHA-256 hash of the canonical JSON representation
of the referenced UACP artifact, using the same canonical JSON algorithm. This creates a
cryptographic binding between the manifest and the artifact.

### Hash chain

When `prev_manifest_id` is present, the chain forms a linked sequence:

```
manifest_N.prev_manifest_id → manifest_{N-1}.id
manifest_N.artifact_hash → artifact_N
```

A verifier MUST check that `manifest_{N-1}.id` exists and that its `manifest_signature`
is valid before trusting the chain.

---

## §9 — Compliance Mapping (informative)

This section is informative. It maps Capture-Manifest fields to regulatory disclosure
requirements.

### GDPR Article 13/14 (notice at/after collection)

| GDPR requirement | Capture-Manifest field |
|------------------|----------------------|
| Identity of controller | `agent.name` + `agent.version` |
| Purposes of processing | `consent.basis` + `consent.gdpr_article` |
| Legal basis | `consent.basis` + `consent.gdpr_article` |
| Recipients of data | Implicit (the FusionLayer engine is the recipient) |
| Retention period | `retention_policy.delete_after_days` |
| Data subject rights | `consent.notice_url` |

### CCPA §1798.100

| CCPA requirement | Capture-Manifest field |
|-----------------|----------------------|
| Categories of PI collected | `consent.ccpa_category` |
| Purposes for collection | `consent.basis` |
| Third parties shared with | Implicit |
| Consumer rights notice | `consent.notice_url` |

---

## §10 — Access and Permission Model

This section defines how a **capture agent** (e.g., the FusionLayer daemon) requests permission
to capture AI conversation data from a **vendor application** (e.g., Cursor, Claude Code) and
how permissions may be revoked.

### 10.1 Permission grant

A vendor application MAY expose a permission endpoint or system-level IPC channel that a
capture agent MUST negotiate before reading any conversation data. This grant is
**out-of-band** relative to Capture-Manifest itself — the manifest records the outcome
(consent fields), not the negotiation.

Implementations SHOULD support the following permission grant mechanisms in order of
preference:

1. **System-level IPC declaration**: The vendor application exposes a named pipe, Unix
   socket, or D-Bus interface that responds to a capability-query message from the
   capture agent. The vendor responds with a signed grant token (ed25519 signature over
   `agent_key_id || timestamp || allowed_kinds[]`).

2. **Capture Manifest Endpoint declaration**: The vendor application publishes a
   `GET /capture-manifest/permissions` REST endpoint on localhost that returns a
   `CaptureMisPermissionsGrant` JSON object.

3. **Static filesystem marker**: The vendor application writes a manifest-permissions file
   to a canonical path (e.g., `~/.config/<vendor>/capture-manifest.json`) that the
   capture agent reads. This method requires no runtime negotiation; it is appropriate
   for open-source vendors that ship the permissions as part of their package.

4. **No explicit grant** (default for legacy/uncooperative vendors): The capture agent
   MAY read vendor-specific storage (SQLite databases, JSONL files) under OS user
   permissions already held by the capturing process. In this case, `consent.basis` MUST
   be `legitimate_interest`, and a Legitimate Interests Assessment SHOULD be documented
   at `consent.notice_url`.

### 10.2 CaptureMisPermissionsGrant object

```json
{
  "capture_manifest_version": "0.1",
  "vendor": "cursor",
  "agent_key_id": "sha256:<capturing-agent-public-key-sha256>",
  "granted_at": "2026-05-21T10:00:00Z",
  "expires_at": "2027-05-21T10:00:00Z",
  "allowed_kinds": ["conversation", "metadata"],
  "revocation_endpoint": "https://localhost:4242/capture-manifest/revoke",
  "grant_signature": "sha256:<vendor-signed-hash-of-this-object>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `capture_manifest_version` | string | REQUIRED | Must match the spec version being implemented. |
| `vendor` | string | REQUIRED | Vendor slug. |
| `agent_key_id` | string | REQUIRED | SHA-256 of the capture agent's ed25519 public key. |
| `granted_at` | string | REQUIRED | ISO 8601 UTC timestamp when grant was issued. |
| `expires_at` | string | optional | ISO 8601 UTC timestamp when grant expires. Absent means no expiry. |
| `allowed_kinds` | array of string | REQUIRED | Permitted capture kinds. Values: `conversation` (full turn content), `metadata` (topology only, no content), `agent_actions` (tool call/result records). |
| `revocation_endpoint` | string | optional | URL to call for real-time grant revocation. |
| `grant_signature` | string | optional | Integrity signature over the grant (minus this field). |

### 10.3 Revocation

The user or vendor MAY revoke a capture grant at any time through one of the following
mechanisms:

1. **Revocation endpoint**: POST to `revocation_endpoint` from the grant. The body MUST
   include `{"agent_key_id": "<capturing-agent-key-id>", "vendor": "<vendor>"}`.

2. **Grant file deletion**: Delete the static filesystem marker (§10.1 mechanism 3).
   The capture agent MUST check for file existence on each startup and stop capturing
   if the file is absent.

3. **System uninstall**: The user removes the capture agent from the system. All
   manifests produced by that agent SHOULD be flagged `retention_policy.delete_reason:
   "Agent uninstalled; revocation implied"`.

Upon receiving revocation notification, the capture agent MUST:
- Stop capturing for the revoked vendor immediately.
- NOT retroactively modify existing manifests (revocation is prospective).
- Emit a final manifest with `consent.basis` set to the basis under which capture
  was originally authorized, plus a `tags` entry of `"capture:revoked"`.

---

## §11 — Privacy Semantics and Vendor Redaction Obligations

This section defines what a vendor or capture agent MUST redact from captured content
before the artifact is stored, and how those redactions are reflected in the manifest.

### 11.1 Redaction obligation levels

Implementations MUST support three redaction obligation levels, which map to the
FusionLayer two-axis privacy model (ADR 0014):

| Level | Captures |
|-------|----------|
| `none` | Full plaintext captured. Vendor MUST have explicit user consent (`consent.basis = explicit_consent`). |
| `balanced` | Standard PII categories removed: email addresses, phone numbers, credit/debit card numbers, Social Security and national ID numbers, IP addresses, physical addresses. |
| `strict` | Balanced PLUS indirect identifiers: person names, organization names, dates of birth, device identifiers, geolocation coordinates, health and financial information. |

The redaction obligation level for a given capture MUST be recorded in the manifest.
Add a `redaction_level` field to the manifest root:

```json
{
  "redaction_level": "balanced"
}
```

This field MUST match the redaction level that was applied to the content before
`artifact_hash` was computed. A verifier receiving a manifest and an artifact SHOULD
confirm that the artifact does not contain pattern matches for the declared
`redaction_level`.

### 11.2 Vendor redaction responsibility

When a vendor exposes a Capture Manifest Endpoint (§10.1 mechanism 2), the vendor
SHOULD apply redactions server-side before the artifact is serialized. The
`redactions[]` array in the manifest SHOULD enumerate the patterns that were applied.

When the capture agent performs client-side redaction (mechanism 1, 3, or 4), it MUST:
1. Apply redaction before writing any content to the artifact.
2. Record each matched pattern in `redactions[]`.
3. Set `agent.name` and `agent.version` accurately so the redaction implementation is
   auditable.

### 11.3 Minimum baseline (informative)

Regardless of user preference, implementations SHOULD apply at minimum `balanced`
redaction to avoid unintentional storage of clear-text credentials or payment card
numbers in the artifact store. The `none` level is provided for use cases where the
user has explicitly and verifiably opted into full-fidelity capture (e.g., enterprise
deployments with audit requirements that need unredacted capture logs).

---

## §12 — Real-Time and Batch Delivery

Capture agents MAY expose captured artifacts and their manifests through two delivery
modes that MAY coexist.

### 12.1 Batch delivery (baseline)

The capture agent reads vendor-specific storage on a configurable polling interval
(recommended default: 30 seconds). New turns since the last poll are packaged into
UACP artifacts with Capture-Manifests and transmitted to the storage backend.

Batch delivery characteristics:
- Capture latency: 0–polling_interval seconds.
- Requires read access to vendor-native storage (SQLite, JSONL, etc.).
- Works with all vendor applications regardless of whether they support IPC.
- Deduplication: the agent MUST track the last-captured artifact ID or timestamp to
  avoid re-capturing turns already recorded. `prev_manifest_id` SHOULD be used to chain
  manifests within a session.

### 12.2 Real-time streaming delivery (optional)

Vendors implementing the IPC permission model (§10.1 mechanism 1) MAY additionally
stream new turns as they are generated, without waiting for a polling interval.

The streaming protocol uses a simple event-stream over the IPC channel:

```
Content-Type: text/event-stream

event: turn
data: {"manifest": {...}, "artifact": {...}}

event: turn
data: {"manifest": {...}, "artifact": {...}}
```

The capture agent consumes events, immediately transmits them to the storage backend,
and does NOT write them to local disk unless the backend is unavailable (in which case
a local queue buffer with configurable max-size SHOULD be used).

Real-time delivery characteristics:
- Capture latency: sub-second (network-bound to storage backend).
- Requires vendor IPC implementation.
- Manifests produced in real-time SHOULD set `captured_at` to the turn timestamp, not
  the time the event was received by the agent.

### 12.3 Choosing a delivery mode

| Factor | Prefer batch | Prefer real-time |
|--------|-------------|-----------------|
| Vendor cooperation | None required | IPC support required |
| Capture latency | Acceptable: 0–30 s | Required: sub-second |
| Network reliability | Tolerant of gaps | Requires persistent connection |
| Implementation cost | Low | Higher (vendor IPC) |

Implementations MUST support batch delivery. Real-time delivery is OPTIONAL. When both
are supported, they MUST NOT produce duplicate manifests for the same turn.

---

## §13 — UACP Compatibility

Capture-Manifest is designed to nest cleanly inside UACP conversation envelopes per
[UACP ADR 0038](https://github.com/hn2/fusionlayer/blob/main/docs/decisions/0038-uacp-context-only-narrowing.md).

### 13.1 Nesting in UACP metadata

A UACP artifact describing an AI conversation MAY include a capture manifest reference
in its `metadata` object:

```json
{
  "id": "<uacp-artifact-id>",
  "version": "0.6",
  "conversations": [...],
  "metadata": {
    "capture_manifest_id": "<manifest-id>",
    "capture_manifest_url": "https://manifests.fusionlayer.app/<manifest-id>"
  }
}
```

The `capture_manifest_id` MUST match the `id` field of the associated Capture-Manifest.
The `capture_manifest_url` SHOULD be a stable, dereferenceable URL where the manifest
can be retrieved.

### 13.2 Artifact hash verification

The `artifact_hash` in the manifest MUST be verified against the UACP artifact before
consuming any content from the artifact. A consumer MUST:

1. Retrieve the Capture-Manifest from `capture_manifest_url`.
2. Compute the canonical SHA-256 hash of the UACP artifact JSON.
3. Assert that the computed hash matches `artifact_hash` from the manifest.
4. If the hashes do not match, reject the artifact as tampered.

### 13.3 UACP version compatibility

| UACP version | Capture-Manifest v0.1 compatibility |
|-------------|-------------------------------------|
| 0.5 | Compatible. Use `metadata.capture_manifest_id`. |
| 0.6 | Compatible. Same as 0.5. |
| < 0.5 | Not supported. Upgrade to UACP ≥ 0.5. |

### 13.4 Privacy mode propagation

When a UACP artifact is produced from a capture that used `redaction_level: strict` or
`redaction_level: balanced`, the Capture-Manifest MUST reflect the actual redaction
applied. The UACP artifact itself SHOULD NOT contain any content that was supposed to be
redacted per the declared `redaction_level`. A consumer MAY verify this by running the
declared `redactions[].pattern_id` patterns against the artifact content and asserting
no matches.

---

## Annex A — Change History

| Version | Date       | Summary |
|---------|------------|---------|
| v0.1    | 2026-05-21 | Initial Capture-Manifest spec. Defines manifest structure, source/agent/consent/redactions/retention-policy objects, artifact hash chain, signing algorithm, and regulatory mapping. |
| v0.1.1  | 2026-05-22 | Added §10 (Access and Permission Model), §11 (Privacy Semantics), §12 (Real-Time and Batch Delivery), §13 (UACP Compatibility). Adds `redaction_level` field and `CaptureMisPermissionsGrant` object. |
