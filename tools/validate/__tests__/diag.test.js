'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  canonicalJson,
  sha256Hex,
  inspectCaptureManifest,
  runCaptureDoctor,
  runCaptureCli,
  CAPTURE_ERROR_CATALOG,
} = require('../index.js')

test('Capture-Manifest doctor and error catalog CLI (#11)', () => {
  const doc = runCaptureDoctor()
  assert.equal(doc.healthy, true)
  assert.ok(Object.keys(CAPTURE_ERROR_CATALOG).length >= 4)

  const cliRes = runCaptureCli(['doctor', '--json'])
  assert.equal(cliRes.exitCode, 0)
  assert.equal(JSON.parse(cliRes.output).healthy, true)
})

test('inspectCaptureManifest validates and maps signature errors (#11)', () => {
  const m = {
    manifest_version: '0.1',
    id: 'cap-1',
    artifact_id: 'art-1',
    artifact_hash: `sha256:${'b'.repeat(64)}`,
    source: { vendor: 'openai', kind: 'chat' },
    agent: { name: 'chatgpt', version: '1.0.0' },
    captured_at: '2026-10-23T00:00:00Z',
    consent: { basis: 'explicit_consent' },
  }
  m.manifest_signature = `sha256:${sha256Hex(canonicalJson(m))}`
  const okInfo = inspectCaptureManifest(m)
  assert.equal(okInfo.valid, true)

  const badInfo = inspectCaptureManifest({ ...m, manifest_signature: `sha256:${'0'.repeat(64)}` })
  assert.equal(badInfo.valid, false)
  assert.equal(badInfo.catalogEntry.code, 'E_CAP_SIGNATURE_MISMATCH')
})

test('runCaptureCli writes to CLI and optional --output file (#12)', () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-out-'))
  try {
    const outFile = path.join(tmpDir, 'doctor.json')
    const res = runCaptureCli(['doctor', '--output', outFile])
    assert.equal(res.exitCode, 0)
    assert.match(res.output, /HEALTHY/)
    assert.equal(JSON.parse(fs.readFileSync(outFile, 'utf8')).healthy, true)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

