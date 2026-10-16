#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const ISO_Z_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const SHA256_RE = /^sha256:[0-9a-f]{64}$/
const SOURCE_KINDS = new Set(['ide', 'chat', 'api', 'mobile', 'cli', 'browser'])
const CONSENT_BASES = new Set(['explicit_consent', 'legitimate_interest', 'contract', 'legal_obligation', 'vital_interests', 'public_task'])
const REDACTION_LEVELS = new Set(['none', 'balanced', 'strict'])
const ALLOWED_KINDS = new Set(['conversation', 'metadata', 'agent_actions'])

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

function validateManifest(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('manifest_not_object')

  const required = ['manifest_version', 'id', 'artifact_id', 'artifact_hash', 'source', 'agent', 'captured_at', 'consent', 'manifest_signature']
  for (const k of required) if (!(k in m)) throw new Error(`missing_required:${k}`)

  if (m.manifest_version !== '0.1') throw new Error('manifest_version_must_be_0.1')
  if (typeof m.id !== 'string' || m.id.length < 1) throw new Error('id_invalid')
  if (typeof m.artifact_id !== 'string' || m.artifact_id.length < 1) throw new Error('artifact_id_invalid')
  if (typeof m.artifact_hash !== 'string' || !SHA256_RE.test(m.artifact_hash)) throw new Error('artifact_hash_invalid')
  if (typeof m.captured_at !== 'string' || !ISO_Z_RE.test(m.captured_at)) throw new Error('captured_at_invalid')
  if (typeof m.manifest_signature !== 'string' || !SHA256_RE.test(m.manifest_signature)) throw new Error('manifest_signature_invalid')

  // source
  const src = m.source
  if (!src || typeof src !== 'object') throw new Error('source_invalid')
  if (typeof src.vendor !== 'string' || src.vendor.length < 1) throw new Error('source.vendor_invalid')
  if (!SOURCE_KINDS.has(src.kind)) throw new Error(`source.kind_invalid:${src.kind}`)

  // agent
  const ag = m.agent
  if (!ag || typeof ag !== 'object') throw new Error('agent_invalid')
  if (typeof ag.name !== 'string' || ag.name.length < 1) throw new Error('agent.name_invalid')
  if (typeof ag.version !== 'string' || !SEMVER_RE.test(ag.version)) throw new Error('agent.version_invalid')

  // consent
  const con = m.consent
  if (!con || typeof con !== 'object') throw new Error('consent_invalid')
  if (!CONSENT_BASES.has(con.basis)) throw new Error(`consent.basis_invalid:${con.basis}`)
  if (con.consented_at !== undefined && !ISO_Z_RE.test(con.consented_at)) throw new Error('consent.consented_at_invalid')

  // redaction_level
  if (m.redaction_level !== undefined && !REDACTION_LEVELS.has(m.redaction_level)) {
    throw new Error(`redaction_level_invalid:${m.redaction_level}`)
  }

  // redactions
  if (m.redactions !== undefined) {
    if (!Array.isArray(m.redactions)) throw new Error('redactions_must_be_array')
    for (let i = 0; i < m.redactions.length; i++) {
      const r = m.redactions[i]
      if (typeof r.pattern_id !== 'string' || r.pattern_id.length < 1) throw new Error(`redactions[${i}].pattern_id_invalid`)
      if (!Number.isInteger(r.count) || r.count < 1) throw new Error(`redactions[${i}].count_invalid`)
    }
  }

  // signature verification
  const declared = m.manifest_signature.slice('sha256:'.length)
  const clone = JSON.parse(JSON.stringify(m))
  delete clone.manifest_signature
  const computed = sha256Hex(canonicalJson(clone))
  if (computed !== declared) throw new Error(`manifest_signature_mismatch:expected=${declared}:got=${computed}`)
}

function validatePermissionGrant(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) throw new Error('grant_not_object')

  const required = ['capture_manifest_version', 'vendor', 'agent_key_id', 'granted_at', 'allowed_kinds']
  for (const k of required) if (!(k in g)) throw new Error(`missing_required:${k}`)

  if (g.capture_manifest_version !== '0.1') throw new Error('capture_manifest_version_must_be_0.1')
  if (typeof g.vendor !== 'string' || g.vendor.length < 1) throw new Error('vendor_invalid')
  if (typeof g.agent_key_id !== 'string' || !SHA256_RE.test(g.agent_key_id)) throw new Error('agent_key_id_invalid')
  if (typeof g.granted_at !== 'string' || !ISO_Z_RE.test(g.granted_at)) throw new Error('granted_at_invalid')

  if (g.expires_at !== undefined) {
    if (typeof g.expires_at !== 'string' || !ISO_Z_RE.test(g.expires_at)) throw new Error('expires_at_invalid')
  }

  if (!Array.isArray(g.allowed_kinds) || g.allowed_kinds.length < 1) throw new Error('allowed_kinds_must_be_non_empty_array')
  for (let i = 0; i < g.allowed_kinds.length; i++) {
    if (!ALLOWED_KINDS.has(g.allowed_kinds[i])) throw new Error(`allowed_kinds[${i}]_invalid:${g.allowed_kinds[i]}`)
  }

  if (g.revocation_endpoint !== undefined) {
    if (typeof g.revocation_endpoint !== 'string' || g.revocation_endpoint.length < 1) throw new Error('revocation_endpoint_invalid')
  }

  if (g.grant_signature !== undefined) {
    if (typeof g.grant_signature !== 'string' || !SHA256_RE.test(g.grant_signature)) throw new Error('grant_signature_invalid')
  }

  if (g.revoked === true) {
    if (g.revoked_at === undefined) throw new Error('revoked_at_required_when_revoked')
    if (typeof g.revoked_at !== 'string' || !ISO_Z_RE.test(g.revoked_at)) throw new Error('revoked_at_invalid')
  }
}

function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node tools/validate/index.js <path-to-manifest.json>')
    process.exit(2)
  }

  const abs = path.resolve(process.cwd(), file)
  let raw
  try { raw = fs.readFileSync(abs, 'utf8') } catch (e) {
    console.error(`FAIL: cannot read ${file}: ${e.message}`)
    process.exit(1)
  }

  let manifest
  try { manifest = JSON.parse(raw) } catch (e) {
    console.error(`FAIL: ${file}: invalid JSON: ${e.message}`)
    process.exit(1)
  }

  try {
    validateManifest(manifest)
    console.log(`PASS: ${file}`)
  } catch (err) {
    console.error(`FAIL: ${file}: ${err.message}`)
    process.exit(1)
  }
}

if (require.main === module) main()

module.exports = { canonicalJson, sha256Hex, validateManifest, validatePermissionGrant }
