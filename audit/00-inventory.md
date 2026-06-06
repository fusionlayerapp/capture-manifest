# Capture-Manifest — Security & Quality Inventory (audit 00)

Read-only reconnaissance. Repo: `C:\Projects\capture-manifest`. Date: 2026-05-28.
Scope: full repo. 12 tracked files, 6 commits (2026-05-21 → 2026-05-22). Tiny repo.

---

## 1. Stack

- **Language:** JavaScript (Node.js, CommonJS — `"type": "commonjs"`). `engines.node >= 18`.
- **Runtime/std-lib only:** `node:crypto`, `node:fs`, `node:path`. **Zero third-party dependencies.** No `node_modules`, no lockfiles.
- **Test framework:** Node built-in `node --test` + `node:assert/strict`. 36 tests, all pass (verified).
- **Build tooling:** none (no bundler, no TS, no linter config — no eslint/biome present).
- **Layout (spec docs vs code):**
  - `spec/v0.1/CAPTURE-MANIFEST.md` (515 lines) — normative spec, the primary deliverable.
  - `schema/capture-manifest.schema.json` (236 lines) — JSON Schema draft-07.
  - `tools/create/` and `tools/validate/` — reference CLI + library impls, each its own publishable npm package (`bin` entries for `npx`).
  - `examples/minimal.json`, `examples/full.json` — signed sample manifests.
  - Root `package.json` — aggregator with `test`/`validate`/`create` scripts. License Apache-2.0.
- This is a standard + reference implementation, not a service. No server, no network code, no DB.

## 2. Committed secrets

**None.** No committed `.env`, no private keys, no API tokens, no credentials.
- `examples/full.json:26` contains `"pattern_id": "secret:openai-key"` — this is a redaction *pattern identifier* (metadata describing that an OpenAI key was redacted), not an actual key. The spec (§6, lines 182) explicitly forbids the redacted text from appearing in the manifest. Correct by design.
- No `.gitignore` exists, but there is nothing sensitive to ignore.

## 3. Credential handling

None. The library performs no auth, holds no secrets, makes no outbound calls. `consent.user_id` is spec'd as "MUST NOT be PII" (schema line 146; spec §5 line 151) but this is **not enforced** by the validator — purely advisory.

## 4. AuthN / AuthZ

None in code. The spec (§10) describes an out-of-band permission/grant model (`CaptureMisPermissionsGrant`, ed25519 grant tokens, revocation endpoints) but **no part of §10 is implemented** — it is spec-only. The reference tools only create/validate manifest JSON.

## 5. Input validation & injection surfaces

- **Manifest parsing (`validate/index.js`):** `JSON.parse` on file contents wrapped in try/catch (lines 100-103). Manual field validation with typed checks + regex (semver, ISO-Z timestamp, `sha256:[0-9a-f]{64}`). No `eval`, no dynamic `require`, no deserialization of code. Safe.
- **Schema vs validator divergence (correctness gap, not a vuln):**
  - Validator does **not** enforce `additionalProperties: false`. The JSON Schema rejects unknown keys; the JS validator silently accepts them. A manifest with extra top-level fields passes `validateManifest()` but fails the schema. Because the signature covers all keys, such a manifest is internally consistent but non-conformant.
  - Validator does **not** validate `tags` at all (no type/maxItems/uniqueItems check; schema enforces `maxItems:32`, `uniqueItems:true`).
  - Validator does **not** validate `retention_policy` contents (schema constrains it; validator ignores it).
  - Validator does **not** validate `source.url/document_id/session_id`, `agent.platform/key_id`, or `redactions[].placeholder/pattern_label` length bounds.
  - Net: the two validators (JS impl vs JSON Schema) disagree on what is valid. For a *standard*, this is the highest-value finding — conformance suites built on one will diverge from the other.
- **Path handling (`validate/index.js:92`):** `path.resolve(process.cwd(), file)` on a CLI arg. CLI-only, user supplies their own path; no traversal concern in this context.
- **`/dev/stdin` read (`create/index.js:166`):** hardcoded `/dev/stdin` for `--artifact-content -`. Will not work on Windows (no `/dev/stdin`); should use fd `0`. Functional bug, not security.
- **Prompt-injection paths into captured context:** out of scope for this repo — the library only hashes artifact bytes (`sha256HexBytes`) and never interprets, renders, or forwards captured content. Captured content never enters the manifest (only its hash + redaction counts). No injection surface here; that risk lives in the capture agent (not in this repo).

## 6. Encryption / signing correctness

- **"Signature" is a SHA-256 hash, not a digital signature.** `manifest_signature` (create/index.js:98, validate/index.js:78-82) = `sha256(canonicalJson(manifest_without_signature))`. This provides **integrity against accidental corruption only** — it is **not** a cryptographic signature and provides **no authenticity**: anyone who edits a manifest can recompute a valid `manifest_signature`. The `signature_mismatch` test (validate.test.js:78) only catches tampering that *forgets* to re-hash.
  - The spec compounds this: it names the field `manifest_signature` and §8 calls it a "signature," while `agent.key_id` is described as a "Public key identifier for verifying the manifest signature" (schema:102, spec §4) — implying asymmetric verification that **does not exist**. `key_id` is never used by any code. This is a **terminology/security-model mismatch** that could mislead implementers and regulators into believing manifests are authenticatable. Recommend either (a) rename to `manifest_hash`/`integrity` and drop signature language, or (b) actually implement ed25519 signing keyed by `agent.key_id`.
  - §10 already references ed25519 (lines 275, 312) for grant tokens but provides no impl and no key management.
- **Canonical JSON is non-standard / under-specified.** `canonicalJson` (both files, duplicated) = `JSON.stringify` after recursive key-sort. This does **not** normalize: unicode escaping, number formatting (e.g. `1e3` vs `1000`, `-0`), or duplicate-key handling. It is not JCS (RFC 8785). The spec says "same algorithm as UACP signing" but does not define it normatively in this repo. Two conformant implementations in different languages can produce different bytes → different hashes → spurious `signature_mismatch`. For a cross-vendor standard this is a real interoperability risk.
- **Hash algorithm:** SHA-256 via `node:crypto` — fine. Hex lowercase enforced by regex. Comparison uses plain `!==` (validate/index.js:82) — not constant-time, but irrelevant since this is integrity not a secret/MAC.

## 7. Data isolation

Not applicable — no multi-tenant storage, no DB, no per-user data. The library is stateless.

## 8. Logging hygiene

Minimal and clean. Output is to stdout (the manifest / `PASS:`) and stderr (`FAIL:`, `Error:`, usage). No secrets logged. One minor note: `validate/index.js:82` echoes both expected and computed hashes in the error string — harmless (they're public integrity hashes). No `console.log` debug leftovers.

## 9. Duplication / copy-paste

Significant for a repo this small:
- `sortKeys`, `canonicalJson`, `sha256Hex` are **duplicated verbatim** in `tools/create/index.js` (11-29) and `tools/validate/index.js` (15-29).
- `SOURCE_KINDS`, `CONSENT_BASES`, `REDACTION_LEVELS` Sets duplicated in both (create:7-9, validate:11-13).
- The constants are also a **third copy** of the enums in `schema/capture-manifest.schema.json` and a **fourth** in the spec tables — four sources of truth for the same enums. Drift risk: add a `source.kind` and you must edit 4 places.
- Test files repeat the `clone → delete signature → re-sign` boilerplate ~10× in `validate.test.js` (a `resign(m)` helper would remove it).
- Recommendation: extract a shared `lib/canonical.js` + `lib/constants.js`. Tools currently can't share because each is its own npm package with `files:["index.js"]`; resolve by publishing a `capture-manifest-core` package or generating the JS enums from the schema.

## 10. TODO / FIXME / HACK inventory

**Zero.** No TODO/FIXME/HACK/XXX markers anywhere in the repo (verified by grep across all non-`.git` files).

## 11. Error handling

Generally good — explicit throws with stable machine-readable codes (`missing_required:<field>`, `consent.basis_invalid:<v>`). No empty catches. No swallowed exceptions.
- **Silent acceptance, not silent failure:** the gaps in §5 (validator ignores `tags`, `retention_policy`, `additionalProperties`, optional-field bounds) mean malformed-but-signed manifests pass validation silently. This is the main error-handling weakness — it fails *open* on unknown/unchecked fields rather than rejecting.
- `validate/index.js:79` and `create/index.js:97` use `JSON.parse(JSON.stringify(m))` for deep clone — works, but throws on non-JSON values (e.g. `undefined`/functions silently dropped; `BigInt` throws). Inputs are already JSON so acceptable.
- CLI exit codes are consistent and documented (0 valid / 1 error / 2 bad-arg).

## 12. Top files most in need of refactoring

Ranked by risk × churn. Churn is low across the board (repo is 2 days old, ≤3 commits/file), so risk dominates.

| Rank | File | LOC | Churn (commits) | Why |
|------|------|-----|-----------------|-----|
| 1 | `tools/validate/index.js` | 116 | 2 | Diverges from the JSON Schema (no `additionalProperties`, no `tags`/`retention_policy`/optional-bound checks). For a standard, the reference validator must match the schema or conformance fragments. Highest risk. |
| 2 | `spec/v0.1/CAPTURE-MANIFEST.md` | 515 | 2 | Calls a SHA-256 hash a "signature"; ties `agent.key_id` to "verifying the signature" implying asymmetric crypto that doesn't exist; "canonical JSON" not normatively defined (cross-impl hash divergence). Security-model and interop ambiguity. |
| 3 | `tools/create/index.js` | 189 | 1 | Duplicates canonical/hash/enum logic; `/dev/stdin` hardcode breaks on Windows; `manifest_signature` integrity-only despite "signed" naming. |
| 4 | `schema/capture-manifest.schema.json` | 236 | 2 | Source-of-truth for enums duplicated in 3 other places; `$id` points to a GitHub URL while memory/spec say the standard lives on uacp.dev/fusionlayer.app — stale identifier. |
| 5 | `tools/validate/__tests__/validate.test.js` | 160 | 2 | Heavy re-sign boilerplate; does not test the schema-divergence cases (extra keys, bad `tags`, bad `retention_policy`) — so the §5/§11 gaps are untested. |

(Other files — examples, package.json files, README, create.test.js — are small/stable and need no refactor.)

## 13. Deletion candidates

This is a lean, mostly non-redundant repo. True deletions are minimal; most "sheddable" LOC is duplication to be *consolidated*, not deleted outright.

| Candidate | LOC | Notes |
|-----------|-----|-------|
| Duplicated `sortKeys`+`canonicalJson`+`sha256Hex` in `create/index.js` (11-29) | ~19 | Net-deletable after extracting shared lib (logic moves, ~19 LOC removed from create). |
| Duplicated enum Sets in `create/index.js` (7-9) | 3 | Removable once enums are shared/generated. |
| Duplicated enum Sets in `validate/index.js` (11-13) | 3 | Same. |
| Re-sign boilerplate in `validate.test.js` (replace with a `resign()` helper) | ~20 net | Refactor, not raw delete. |

**Total realistically sheddable via consolidation: ~45 LOC** (out of ~1,150 non-spec LOC). No dead files, no orphaned modules, no commented-out code blocks. Nothing should be deleted without first adding the shared module.

---

### Cross-cutting recommendations (priority order)
1. **Fix the security-model language** (§6 / spec §4, §8): stop calling a bare SHA-256 a "signature," or implement real ed25519 signing keyed by `agent.key_id`. Regulator-legibility is the product's selling point — an unauthenticated "signature" undercuts it.
2. **Normatively define canonical JSON** (adopt RFC 8785 JCS or specify exactly) to guarantee cross-language hash agreement.
3. **Make the reference validator match the schema** (add `additionalProperties` rejection, `tags`, `retention_policy`, optional-field bounds) + add tests for those cases.
4. **Single source of truth for enums** (generate JS from schema or share a core package).
5. Fix the Windows `/dev/stdin` bug in `create/index.js:166`.
