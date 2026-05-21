'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { canonicalJson, sha256Hex, validateManifest } = require('../index.js')

function makeValid() {
  const m = {
    manifest_version: '0.1',
    id: '550e8400-e29b-41d4-a716-446655440000',
    artifact_id: 'b3f8a21c-4e72-4d9b-9c03-e1a2f5d8b6c9',
    artifact_hash: 'sha256:' + 'a'.repeat(64),
    source: { vendor: 'cursor', kind: 'ide' },
    agent: { name: 'fusionlayer-daemon', version: '1.4.2' },
    captured_at: '2026-05-21T10:30:00Z',
    consent: { basis: 'legitimate_interest', gdpr_article: '6(1)(f)' },
  }
  const clone = JSON.parse(JSON.stringify(m))
  m.manifest_signature = 'sha256:' + sha256Hex(canonicalJson(clone))
  return m
}

test('valid minimal manifest validates', () => {
  const m = makeValid()
  assert.doesNotThrow(() => validateManifest(m))
})

test('manifest signature verified', () => {
  const m = makeValid()
  const clone = JSON.parse(JSON.stringify(m))
  const declared = clone.manifest_signature.slice('sha256:'.length)
  delete clone.manifest_signature
  const computed = sha256Hex(canonicalJson(clone))
  assert.equal(computed, declared)
})

test('missing required field rejected', () => {
  for (const field of ['manifest_version', 'id', 'artifact_id', 'artifact_hash', 'source', 'agent', 'captured_at', 'consent', 'manifest_signature']) {
    const m = makeValid()
    delete m[field]
    assert.throws(() => validateManifest(m), new RegExp(`missing_required:${field}`), `expected missing_required:${field}`)
  }
})

test('wrong manifest_version rejected', () => {
  const m = makeValid()
  m.manifest_version = '1.0'
  assert.throws(() => validateManifest(m), /manifest_version_must_be_0.1/)
})

test('invalid artifact_hash format rejected', () => {
  const m = makeValid()
  m.artifact_hash = 'not-a-hash'
  const clone = JSON.parse(JSON.stringify(m))
  delete clone.manifest_signature
  m.manifest_signature = 'sha256:' + sha256Hex(canonicalJson(clone))
  assert.throws(() => validateManifest(m), /artifact_hash_invalid/)
})

test('invalid source.kind rejected', () => {
  const m = makeValid()
  m.source.kind = 'unknown-kind'
  const clone = JSON.parse(JSON.stringify(m))
  delete clone.manifest_signature
  m.manifest_signature = 'sha256:' + sha256Hex(canonicalJson(clone))
  assert.throws(() => validateManifest(m), /source.kind_invalid/)
})

test('invalid consent.basis rejected', () => {
  const m = makeValid()
  m.consent.basis = 'made_up_basis'
  const clone = JSON.parse(JSON.stringify(m))
  delete clone.manifest_signature
  m.manifest_signature = 'sha256:' + sha256Hex(canonicalJson(clone))
  assert.throws(() => validateManifest(m), /consent.basis_invalid/)
})

test('signature mismatch rejected', () => {
  const m = makeValid()
  m.id = 'tampered-id'
  assert.throws(() => validateManifest(m), /manifest_signature_mismatch/)
})

test('redactions with valid entries validates', () => {
  const m = makeValid()
  m.redactions = [
    { pattern_id: 'pii:email', count: 2, placeholder: '[EMAIL]' },
    { pattern_id: 'secret:api-key', count: 1 },
  ]
  const clone = JSON.parse(JSON.stringify(m))
  delete clone.manifest_signature
  m.manifest_signature = 'sha256:' + sha256Hex(canonicalJson(clone))
  assert.doesNotThrow(() => validateManifest(m))
})

test('redaction with count < 1 rejected', () => {
  const m = makeValid()
  m.redactions = [{ pattern_id: 'pii:email', count: 0 }]
  const clone = JSON.parse(JSON.stringify(m))
  delete clone.manifest_signature
  m.manifest_signature = 'sha256:' + sha256Hex(canonicalJson(clone))
  assert.throws(() => validateManifest(m), /redactions\[0\].count_invalid/)
})

test('prev_manifest_id accepted as optional', () => {
  const m = makeValid()
  m.prev_manifest_id = '00000000-0000-0000-0000-000000000000'
  const clone = JSON.parse(JSON.stringify(m))
  delete clone.manifest_signature
  m.manifest_signature = 'sha256:' + sha256Hex(canonicalJson(clone))
  assert.doesNotThrow(() => validateManifest(m))
})

test('all consent basis values accepted', () => {
  const bases = ['explicit_consent', 'legitimate_interest', 'contract', 'legal_obligation', 'vital_interests', 'public_task']
  for (const basis of bases) {
    const m = makeValid()
    m.consent.basis = basis
    const clone = JSON.parse(JSON.stringify(m))
    delete clone.manifest_signature
    m.manifest_signature = 'sha256:' + sha256Hex(canonicalJson(clone))
    assert.doesNotThrow(() => validateManifest(m), `basis ${basis} should be valid`)
  }
})
