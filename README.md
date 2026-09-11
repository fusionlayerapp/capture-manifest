# Capture-Manifest

**AI capture provenance protocol** — a machine-readable record of where an AI conversation artifact came from, who captured it, when, under what consent, and what was redacted.

Spun out of [UACP](https://github.com/hn2/uacp) per ADR 0038. Sibling protocols: [AAP](https://github.com/hn2/aap) (operator/action descriptions), [UACP](https://github.com/hn2/uacp) (context payloads).

## Problem

When an AI-generated artifact (a chat transcript, a code diff, a generated document) moves between tools, there is usually no standard record of where it came from, who captured it, when, under what consent basis, and what was redacted before it left the capture point — the exact audit trail GDPR Article 13/14, CCPA §1798.100 and the EU AI Act ask for. Capture-Manifest is a small signed JSON record that travels with (or references) the artifact and answers those questions in a machine-readable, regulator-legible way.

## Spec

- [`spec/v0.1/CAPTURE-MANIFEST.md`](spec/v0.1/CAPTURE-MANIFEST.md) — normative specification
- [`schema/capture-manifest.schema.json`](schema/capture-manifest.schema.json) — JSON Schema

## Create a manifest

```bash
# one-off (no install)
npx capture-manifest-create \
  --artifact-id art-001 \
  --artifact-hash sha256:<hex> \
  --vendor cursor --kind ide \
  --agent-name my-daemon --agent-version 1.0.0 \
  --consent-basis legitimate_interest \
  --pretty

# or install globally
npm install -g capture-manifest-create
capture-manifest-create --artifact-id art-001 --artifact-content "$(cat artifact.json)" \
  --vendor cursor --kind ide \
  --agent-name my-daemon --agent-version 1.0.0 \
  --consent-basis legitimate_interest

# programmatic
const { createManifest } = require('capture-manifest-create')
const manifest = createManifest({
  artifact_id: 'art-001',
  artifact: fs.readFileSync('artifact.json', 'utf8'),  // or pre-computed hash: 'sha256:<hex>'
  source: { vendor: 'cursor', kind: 'ide' },
  agent: { name: 'my-daemon', version: '1.0.0' },
  consent: { basis: 'legitimate_interest' },
})
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2))
```

## Validate a manifest

```bash
# one-off (no install)
npx capture-manifest-validate path/to/manifest.json

# or install globally
npm install -g capture-manifest-validate
capture-manifest-validate my-manifest.json

# programmatic (throws on invalid)
const { validateManifest } = require('capture-manifest-validate')
try {
  validateManifest(JSON.parse(fs.readFileSync('manifest.json', 'utf8')))
  console.log('valid')
} catch (err) {
  console.error('invalid:', err.message)
}
```

Exit code 0 = valid. Exit code 1 = validation error or bad file. Exit code 2 = missing argument.

## Worked example

[`examples/minimal.json`](examples/minimal.json) is a valid manifest for an artifact captured from a Continue.dev session:

```json
{
  "manifest_version": "0.1",
  "id": "mfst-00000000-0000-0000-0000-000000000001",
  "artifact_id": "art-00000000-0000-0000-0000-000000000001",
  "artifact_hash": "sha256:19a5b2e0dc16158a300b803721273460d9970dfabe58c2066a7613070b07a4fc",
  "source": { "vendor": "continue", "kind": "ide" },
  "agent": { "name": "fusionlayer-daemon", "version": "1.0.0" },
  "captured_at": "2026-05-21T10:00:01Z",
  "consent": { "basis": "explicit_consent" },
  "manifest_signature": "sha256:b045885e4cb9b3adedc07c42f2db51e63a7a3a50352435801c0ec26893cb6450"
}
```

`artifact_hash` binds the manifest to the exact artifact bytes (SHA-256 of its canonical JSON) so the manifest cannot be replayed against a different artifact. `consent.basis` records the legal basis under which the artifact was captured. [`examples/full.json`](examples/full.json) shows the same record with redaction and permission-grant fields populated. Validate either with `npx capture-manifest-validate examples/minimal.json`.

## Run tests

```bash
npm test   # 50 tests (manifest validator + permission-grant validator + create tool)
```

## Key concepts

A Capture-Manifest answers: *where did this artifact come from, who captured it, when, under what consent, and what was stripped?*

It is designed to be regulator-legible (GDPR Article 13/14, CCPA §1798.100, EU AI Act).

The manifest references a UACP artifact by `artifact_id` and binds to it via `artifact_hash` (SHA-256 of the artifact's canonical JSON). Multiple manifests can chain via `prev_manifest_id`.

### Spec coverage (v0.1)

- §1–9: Core fields, signing, consent, redactions, GDPR/CCPA mapping
- §10: Permission model (IPC / REST / filesystem grant mechanisms, `CaptureMisPermissionsGrant`)
- §11: Privacy semantics (`redaction_level`: `none` | `balanced` | `strict`)
- §12: Delivery modes (batch polling default 30s, real-time IPC event-stream)
- §13: UACP compatibility (nesting in UACP metadata, artifact hash verification)

## License

Apache 2.0
