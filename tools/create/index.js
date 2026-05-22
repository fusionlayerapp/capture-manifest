#!/usr/bin/env node
'use strict'

const crypto = require('node:crypto')
const { randomUUID } = require('node:crypto')

const SOURCE_KINDS = new Set(['ide', 'chat', 'api', 'mobile', 'cli', 'browser'])
const CONSENT_BASES = new Set(['explicit_consent', 'legitimate_interest', 'contract', 'legal_obligation', 'vital_interests', 'public_task'])
const REDACTION_LEVELS = new Set(['none', 'balanced', 'strict'])

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k])
  return out
}

function canonicalJson(obj) {
  return JSON.stringify(sortKeys(obj))
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex')
}

function sha256HexBytes(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

/**
 * Create a signed Capture-Manifest object.
 *
 * @param {object} opts
 * @param {string} [opts.id]              - Manifest UUID (auto-generated if omitted)
 * @param {string} opts.artifact_id       - UACP artifact ID
 * @param {string|Buffer} opts.artifact   - The artifact bytes/string to hash, OR pre-computed hash string (sha256:hex)
 * @param {object} opts.source            - { vendor: string, kind: string, url?, document_id?, session_id? }
 * @param {object} opts.agent             - { name: string, version: string, platform?, key_id? }
 * @param {string} [opts.captured_at]     - ISO 8601 UTC timestamp (defaults to now)
 * @param {object} opts.consent           - { basis: string, gdpr_article?, consented_at?, ... }
 * @param {string} [opts.redaction_level] - 'none' | 'balanced' | 'strict'
 * @param {Array}  [opts.redactions]      - [{ pattern_id, count, placeholder?, pattern_label? }, ...]
 * @param {string} [opts.prev_manifest_id]
 * @param {object} [opts.retention_policy]
 * @param {Array}  [opts.tags]
 * @returns {object} Complete signed manifest
 */
function createManifest(opts) {
  if (!opts || typeof opts !== 'object') throw new Error('opts_required')

  if (!opts.artifact_id || typeof opts.artifact_id !== 'string') throw new Error('artifact_id_required')
  if (!opts.source || typeof opts.source !== 'object') throw new Error('source_required')
  if (!opts.source.vendor || typeof opts.source.vendor !== 'string') throw new Error('source.vendor_required')
  if (!SOURCE_KINDS.has(opts.source.kind)) throw new Error(`source.kind_invalid:${opts.source.kind}`)
  if (!opts.agent || typeof opts.agent !== 'object') throw new Error('agent_required')
  if (!opts.agent.name || typeof opts.agent.name !== 'string') throw new Error('agent.name_required')
  if (typeof opts.agent.version !== 'string') throw new Error('agent.version_required')
  if (!opts.consent || typeof opts.consent !== 'object') throw new Error('consent_required')
  if (!CONSENT_BASES.has(opts.consent.basis)) throw new Error(`consent.basis_invalid:${opts.consent.basis}`)

  if (opts.redaction_level !== undefined && !REDACTION_LEVELS.has(opts.redaction_level)) {
    throw new Error(`redaction_level_invalid:${opts.redaction_level}`)
  }

  let artifact_hash
  if (opts.artifact !== undefined) {
    if (typeof opts.artifact === 'string' && opts.artifact.startsWith('sha256:')) {
      artifact_hash = opts.artifact
    } else {
      const buf = typeof opts.artifact === 'string'
        ? Buffer.from(opts.artifact, 'utf8')
        : opts.artifact
      artifact_hash = 'sha256:' + sha256HexBytes(buf)
    }
  } else {
    throw new Error('artifact_required: provide artifact bytes/string or pre-computed hash (sha256:hex)')
  }

  const m = {
    manifest_version: '0.1',
    id: opts.id || randomUUID(),
    artifact_id: opts.artifact_id,
    artifact_hash,
    source: { ...opts.source },
    agent: { ...opts.agent },
    captured_at: opts.captured_at || new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    consent: { ...opts.consent },
  }

  if (opts.redaction_level !== undefined) m.redaction_level = opts.redaction_level
  if (opts.redactions !== undefined) m.redactions = opts.redactions
  if (opts.prev_manifest_id !== undefined) m.prev_manifest_id = opts.prev_manifest_id
  if (opts.retention_policy !== undefined) m.retention_policy = opts.retention_policy
  if (opts.tags !== undefined) m.tags = opts.tags

  const clone = JSON.parse(JSON.stringify(m))
  m.manifest_signature = 'sha256:' + sha256Hex(canonicalJson(clone))

  return m
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`Usage: node tools/create/index.js [options]

Creates a signed Capture-Manifest JSON object and prints it to stdout.

Options:
  --artifact-id <id>        Artifact identifier (required)
  --artifact-content <text> Artifact content to hash (use - for stdin)
  --artifact-hash <hash>    Pre-computed artifact hash (sha256:<hex>)
  --vendor <vendor>         Source vendor slug, e.g. cursor, claude-code (required)
  --kind <kind>             Source kind: ide|chat|api|mobile|cli|browser (required)
  --agent-name <name>       Capturing agent name (required)
  --agent-version <ver>     Capturing agent semver version (required)
  --consent-basis <basis>   Consent basis (required):
                              explicit_consent | legitimate_interest | contract |
                              legal_obligation | vital_interests | public_task
  --redaction-level <lvl>   none | balanced | strict (optional)
  --pretty                  Pretty-print JSON output

Examples:
  node tools/create/index.js \\
    --artifact-id art-001 \\
    --artifact-hash sha256:$(echo -n "hello" | sha256sum | awk '{print $1}') \\
    --vendor cursor --kind ide \\
    --agent-name my-daemon --agent-version 1.0.0 \\
    --consent-basis legitimate_interest \\
    --pretty
`)
    process.exit(0)
  }

  const opts = {}
  let pretty = false

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--artifact-id': opts.artifact_id = args[++i]; break
      case '--artifact-content': opts._artifactContent = args[++i]; break
      case '--artifact-hash': opts.artifact = args[++i]; break
      case '--vendor': opts._vendor = args[++i]; break
      case '--kind': opts._kind = args[++i]; break
      case '--agent-name': opts._agentName = args[++i]; break
      case '--agent-version': opts._agentVersion = args[++i]; break
      case '--consent-basis': opts._consentBasis = args[++i]; break
      case '--redaction-level': opts.redaction_level = args[++i]; break
      case '--pretty': pretty = true; break
      default:
        console.error(`Unknown option: ${args[i]}`)
        process.exit(2)
    }
  }

  if (!opts.artifact_id) { console.error('--artifact-id is required'); process.exit(2) }
  if (!opts._vendor) { console.error('--vendor is required'); process.exit(2) }
  if (!opts._kind) { console.error('--kind is required'); process.exit(2) }
  if (!opts._agentName) { console.error('--agent-name is required'); process.exit(2) }
  if (!opts._agentVersion) { console.error('--agent-version is required'); process.exit(2) }
  if (!opts._consentBasis) { console.error('--consent-basis is required'); process.exit(2) }

  if (opts._artifactContent && !opts.artifact) {
    const content = opts._artifactContent === '-'
      ? require('node:fs').readFileSync('/dev/stdin', 'utf8')
      : opts._artifactContent
    opts.artifact = content
  } else if (!opts.artifact) {
    console.error('Either --artifact-content or --artifact-hash is required')
    process.exit(2)
  }

  opts.source = { vendor: opts._vendor, kind: opts._kind }
  opts.agent = { name: opts._agentName, version: opts._agentVersion }
  opts.consent = { basis: opts._consentBasis }

  try {
    const manifest = createManifest(opts)
    console.log(pretty ? JSON.stringify(manifest, null, 2) : JSON.stringify(manifest))
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }
}

if (require.main === module) main()

module.exports = { createManifest, canonicalJson, sha256Hex }
