# Capture-Manifest

**AI capture provenance protocol** — a machine-readable record of where an AI conversation artifact came from, who captured it, when, under what consent, and what was redacted.

Spun out of [UACP](https://github.com/hn2/uacp) per ADR 0038. Sibling protocols: [AAP](https://github.com/hn2/aap) (operator/action descriptions), [UACP](https://github.com/hn2/uacp) (context payloads).

## Spec

- [`spec/v0.1/CAPTURE-MANIFEST.md`](spec/v0.1/CAPTURE-MANIFEST.md) — normative specification
- [`schema/capture-manifest.schema.json`](schema/capture-manifest.schema.json) — JSON Schema

## Validate a manifest

```bash
# one-off (no install)
npx capture-manifest-validate path/to/manifest.json

# or install globally
npm install -g capture-manifest-validate
capture-manifest-validate my-manifest.json

# programmatic
const { validateManifest } = require('capture-manifest-validate')
const result = validateManifest(JSON.parse(fs.readFileSync('my-manifest.json', 'utf8')))
if (!result.valid) console.error(result.errors)
```

Exit code 0 = valid. Exit code 1 = validation errors. Exit code 2 = cannot read file.

## Run tests

```bash
npm test
```

## Key concepts

A Capture-Manifest answers: *where did this artifact come from, who captured it, when, under what consent, and what was stripped?*

It is designed to be regulator-legible (GDPR Article 13/14, CCPA §1798.100, EU AI Act).

The manifest references a UACP artifact by `artifact_id` and binds to it via `artifact_hash` (SHA-256 of the artifact's canonical JSON). Multiple manifests can chain via `prev_manifest_id`.

## License

Apache 2.0
