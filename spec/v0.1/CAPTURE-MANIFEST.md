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

## Annex A — Change History

| Version | Date       | Summary |
|---------|------------|---------|
| v0.1    | 2026-05-21 | Initial Capture-Manifest spec. Defines manifest structure, source/agent/consent/redactions/retention-policy objects, artifact hash chain, signing algorithm, and regulatory mapping. |
