'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { validatePermissionGrant } = require('../index.js')

function makeValidGrant() {
  return {
    capture_manifest_version: '0.1',
    vendor: 'cursor',
    agent_key_id: 'sha256:' + 'b'.repeat(64),
    granted_at: '2026-05-21T10:00:00Z',
    allowed_kinds: ['conversation', 'metadata'],
  }
}

test('valid minimal grant validates', () => {
  const g = makeValidGrant()
  assert.doesNotThrow(() => validatePermissionGrant(g))
})

test('valid grant with all optional fields validates', () => {
  const g = makeValidGrant()
  g.expires_at = '2027-05-21T10:00:00Z'
  g.revocation_endpoint = 'https://localhost:4242/capture-manifest/revoke'
  g.grant_signature = 'sha256:' + 'c'.repeat(64)
  assert.doesNotThrow(() => validatePermissionGrant(g))
})

test('revoked grant with revoked_at validates', () => {
  const g = makeValidGrant()
  g.revoked = true
  g.revoked_at = '2026-06-01T08:00:00Z'
  assert.doesNotThrow(() => validatePermissionGrant(g))
})

test('revoked grant missing revoked_at rejected', () => {
  const g = makeValidGrant()
  g.revoked = true
  assert.throws(() => validatePermissionGrant(g), /revoked_at_required_when_revoked/)
})

test('missing required fields rejected', () => {
  for (const field of ['capture_manifest_version', 'vendor', 'agent_key_id', 'granted_at', 'allowed_kinds']) {
    const g = makeValidGrant()
    delete g[field]
    assert.throws(() => validatePermissionGrant(g), new RegExp(`missing_required:${field}`), `expected missing_required:${field}`)
  }
})

test('wrong capture_manifest_version rejected', () => {
  const g = makeValidGrant()
  g.capture_manifest_version = '1.0'
  assert.throws(() => validatePermissionGrant(g), /capture_manifest_version_must_be_0.1/)
})

test('invalid agent_key_id format rejected', () => {
  const g = makeValidGrant()
  g.agent_key_id = 'not-a-hash'
  assert.throws(() => validatePermissionGrant(g), /agent_key_id_invalid/)
})

test('invalid granted_at format rejected', () => {
  const g = makeValidGrant()
  g.granted_at = '2026-05-21'
  assert.throws(() => validatePermissionGrant(g), /granted_at_invalid/)
})

test('invalid expires_at format rejected', () => {
  const g = makeValidGrant()
  g.expires_at = 'not-a-date'
  assert.throws(() => validatePermissionGrant(g), /expires_at_invalid/)
})

test('empty allowed_kinds rejected', () => {
  const g = makeValidGrant()
  g.allowed_kinds = []
  assert.throws(() => validatePermissionGrant(g), /allowed_kinds_must_be_non_empty_array/)
})

test('invalid allowed_kinds value rejected', () => {
  const g = makeValidGrant()
  g.allowed_kinds = ['conversation', 'screenshots']
  assert.throws(() => validatePermissionGrant(g), /allowed_kinds\[1\]_invalid/)
})

test('all allowed_kinds values accepted individually', () => {
  for (const kind of ['conversation', 'metadata', 'agent_actions']) {
    const g = makeValidGrant()
    g.allowed_kinds = [kind]
    assert.doesNotThrow(() => validatePermissionGrant(g), `kind ${kind} should be valid`)
  }
})

test('invalid grant_signature format rejected', () => {
  const g = makeValidGrant()
  g.grant_signature = 'not-a-sha256'
  assert.throws(() => validatePermissionGrant(g), /grant_signature_invalid/)
})

test('non-object input rejected', () => {
  assert.throws(() => validatePermissionGrant(null), /grant_not_object/)
  assert.throws(() => validatePermissionGrant([]), /grant_not_object/)
  assert.throws(() => validatePermissionGrant('string'), /grant_not_object/)
})
