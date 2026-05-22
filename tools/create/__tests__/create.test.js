'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { createManifest, canonicalJson, sha256Hex } = require('../index.js')
const { validateManifest } = require('../../validate/index.js')

function baseOpts() {
  return {
    artifact_id: 'art-001',
    artifact: 'hello world',
    source: { vendor: 'cursor', kind: 'ide' },
    agent: { name: 'test-daemon', version: '1.0.0' },
    consent: { basis: 'legitimate_interest' },
  }
}

test('createManifest produces a valid manifest', () => {
  const m = createManifest(baseOpts())
  assert.doesNotThrow(() => validateManifest(m))
})

test('manifest_version is 0.1', () => {
  const m = createManifest(baseOpts())
  assert.equal(m.manifest_version, '0.1')
})

test('id is auto-generated UUID when not provided', () => {
  const m = createManifest(baseOpts())
  assert.match(m.id, /^[0-9a-f-]{36}$/)
})

test('custom id is preserved', () => {
  const opts = { ...baseOpts(), id: 'my-custom-id' }
  const m = createManifest(opts)
  assert.equal(m.id, 'my-custom-id')
})

test('artifact_hash computed correctly from string content', () => {
  const opts = baseOpts()
  opts.artifact = 'hello world'
  const m = createManifest(opts)
  const expected = 'sha256:' + require('node:crypto').createHash('sha256').update('hello world', 'utf8').digest('hex')
  assert.equal(m.artifact_hash, expected)
})

test('pre-computed artifact hash is accepted', () => {
  const opts = baseOpts()
  const hash = 'sha256:' + 'a'.repeat(64)
  opts.artifact = hash
  const m = createManifest(opts)
  assert.equal(m.artifact_hash, hash)
})

test('manifest_signature verifies correctly', () => {
  const m = createManifest(baseOpts())
  const clone = JSON.parse(JSON.stringify(m))
  delete clone.manifest_signature
  const computed = 'sha256:' + sha256Hex(canonicalJson(clone))
  assert.equal(m.manifest_signature, computed)
})

test('captured_at defaults to current UTC time', () => {
  const before = new Date().toISOString().slice(0, 19)
  const m = createManifest(baseOpts())
  assert.ok(m.captured_at >= before + 'Z' || m.captured_at.startsWith(before))
})

test('custom captured_at is preserved', () => {
  const opts = { ...baseOpts(), captured_at: '2026-01-01T00:00:00Z' }
  const m = createManifest(opts)
  assert.equal(m.captured_at, '2026-01-01T00:00:00Z')
})

test('redaction_level is included when provided', () => {
  const opts = { ...baseOpts(), redaction_level: 'balanced' }
  const m = createManifest(opts)
  assert.equal(m.redaction_level, 'balanced')
  assert.doesNotThrow(() => validateManifest(m))
})

test('redactions array is included when provided', () => {
  const opts = {
    ...baseOpts(),
    redactions: [{ pattern_id: 'pii:email', count: 2, placeholder: '[EMAIL]' }],
  }
  const m = createManifest(opts)
  assert.equal(m.redactions.length, 1)
  assert.doesNotThrow(() => validateManifest(m))
})

test('prev_manifest_id is included when provided', () => {
  const opts = { ...baseOpts(), prev_manifest_id: '00000000-0000-0000-0000-000000000000' }
  const m = createManifest(opts)
  assert.equal(m.prev_manifest_id, '00000000-0000-0000-0000-000000000000')
  assert.doesNotThrow(() => validateManifest(m))
})

test('all consent bases are accepted', () => {
  const bases = ['explicit_consent', 'legitimate_interest', 'contract', 'legal_obligation', 'vital_interests', 'public_task']
  for (const basis of bases) {
    const opts = { ...baseOpts(), consent: { basis } }
    assert.doesNotThrow(() => createManifest(opts), `basis ${basis} should be accepted`)
  }
})

test('invalid source.kind throws', () => {
  const opts = { ...baseOpts(), source: { vendor: 'test', kind: 'invalid' } }
  assert.throws(() => createManifest(opts), /source.kind_invalid/)
})

test('invalid consent.basis throws', () => {
  const opts = { ...baseOpts(), consent: { basis: 'made_up' } }
  assert.throws(() => createManifest(opts), /consent.basis_invalid/)
})

test('missing artifact_id throws', () => {
  const opts = baseOpts()
  delete opts.artifact_id
  assert.throws(() => createManifest(opts), /artifact_id_required/)
})

test('missing artifact throws', () => {
  const opts = baseOpts()
  delete opts.artifact
  assert.throws(() => createManifest(opts), /artifact_required/)
})

test('invalid redaction_level throws', () => {
  const opts = { ...baseOpts(), redaction_level: 'aggressive' }
  assert.throws(() => createManifest(opts), /redaction_level_invalid/)
})

test('two manifests for same content have same artifact_hash', () => {
  const opts1 = { ...baseOpts(), id: 'id-1' }
  const opts2 = { ...baseOpts(), id: 'id-2' }
  const m1 = createManifest(opts1)
  const m2 = createManifest(opts2)
  assert.equal(m1.artifact_hash, m2.artifact_hash)
})

test('different content produces different artifact_hash', () => {
  const opts1 = { ...baseOpts(), artifact: 'content A' }
  const opts2 = { ...baseOpts(), artifact: 'content B' }
  const m1 = createManifest(opts1)
  const m2 = createManifest(opts2)
  assert.notEqual(m1.artifact_hash, m2.artifact_hash)
})
