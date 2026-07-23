# Capture-Manifest

**AI capture provenance protocol** — a machine-readable record of where an AI conversation artifact came from, who captured it, when, under what consent, and what was redacted.

Spun out of [UACP](https://github.com/hn2/uacp) per ADR 0038. Sibling protocols: [AAP](https://github.com/hn2/aap) (operator/action descriptions), [UACP](https://github.com/hn2/uacp) (context payloads).

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
