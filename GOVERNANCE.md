# Capture-Manifest — Governance

This document describes how the Capture-Manifest protocol is maintained, how changes are proposed and accepted, and how intellectual property is licensed.

## 1. Stewardship

Capture-Manifest is stewarded by the FusionLayer core team (GitHub: [fusionlayerapp](https://github.com/fusionlayerapp)) as a sibling open provenance specification to the Unified AI Context Protocol ([UACP](https://github.com/fusionlayerapp/uacp)).

## 2. Change Process

- **Editorial** — Clarifications, examples, non-normative text. Patch version bump.
- **Additive** — Backward-compatible optional provenance fields, consent modes, or redaction metadata. Minor version bump.
- **Breaking** — Removal or incompatible modification of required fields or validation rules. Requires a 14-day public comment window and a major version bump.

## 3. Intellectual Property & Licensing

- All repository contents (schemas, tools, test vectors, and specification documents) are licensed under the **Apache License, Version 2.0** (see [`LICENSE`](LICENSE)), which includes an express copyright and patent license (§2–§3).
- At the recipient's option, specification prose (`spec/`, `README.md`, `GOVERNANCE.md`) may also be used under **CC BY 4.0**.
- Contributors certify that they have the right to submit contributions under these terms ([Developer Certificate of Origin](https://developercertificate.org)).

## 4. Security

Security or privacy vulnerabilities in Capture-Manifest schemas or tooling (`tools/validate`, `tools/create`) should be reported privately per [`SECURITY.md`](SECURITY.md).
