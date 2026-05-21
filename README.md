# Capture-Manifest

**AI capture provenance protocol** — a machine-readable record of where an AI conversation artifact came from, who captured it, when, under what consent, and what was redacted.

Spun out of [UACP](https://github.com/hn2/uacp) per ADR 0038. Sibling protocols: [AAP](https://github.com/hn2/aap) (operator/action descriptions), [UACP](https://github.com/hn2/uacp) (context payloads).

## Spec

- [`spec/v0.1/CAPTURE-MANIFEST.md`](spec/v0.1/CAPTURE-MANIFEST.md) — normative specification
- [`schema/capture-manifest.schema.json`](schema/capture-manifest.schema.json) — JSON Schema

## Validate a manifest

```bash
node tools/validate/index.js path/to/manifest.json
```

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
