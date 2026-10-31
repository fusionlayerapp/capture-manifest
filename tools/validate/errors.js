'use strict'

const CAPTURE_ERROR_CATALOG = Object.freeze({
  E_CAP_SCHEMA_INVALID: {
    code: 'E_CAP_SCHEMA_INVALID',
    level: 'ERROR',
    category: 'schema',
    retryable: false,
    message: 'Capture manifest or permission grant is missing required fields or has invalid format.',
    hint: 'Ensure manifest_version="0.1", id, artifact_id, artifact_hash, source, agent, captured_at, consent, and manifest_signature are valid.',
  },
  E_CAP_SIGNATURE_MISMATCH: {
    code: 'E_CAP_SIGNATURE_MISMATCH',
    level: 'SECURITY',
    category: 'crypto',
    retryable: false,
    message: 'Capture manifest_signature does not match canonical SHA-256 digest of the manifest.',
    hint: 'Recompute sha256(canonicalJson(manifestWithoutSignature)).',
  },
  E_CAP_CONSENT_INVALID: {
    code: 'E_CAP_CONSENT_INVALID',
    level: 'SECURITY',
    category: 'gdpr',
    retryable: false,
    message: 'Capture manifest lacks a valid GDPR Art. 6 lawful basis in consent.basis.',
    hint: 'Use one of [explicit_consent, legitimate_interest, contract, legal_obligation, vital_interests, public_task].',
  },
  E_CAP_GRANT_REVOKED: {
    code: 'E_CAP_GRANT_REVOKED',
    level: 'WARN',
    category: 'permission',
    retryable: false,
    message: 'Capture permission grant has been revoked or is missing revoked_at timestamp.',
    hint: 'Request a fresh permission grant from the user.',
  },
})

function lookupCaptureError(codeOrErr) {
  if (!codeOrErr) return null
  const raw = typeof codeOrErr === 'string' ? codeOrErr : (codeOrErr.code || codeOrErr.message || '')
  const upper = raw.trim().toUpperCase()
  if (CAPTURE_ERROR_CATALOG[upper]) return CAPTURE_ERROR_CATALOG[upper]
  if (raw.includes('signature_mismatch')) return CAPTURE_ERROR_CATALOG.E_CAP_SIGNATURE_MISMATCH
  if (raw.includes('consent')) return CAPTURE_ERROR_CATALOG.E_CAP_CONSENT_INVALID
  if (raw.includes('revoked')) return CAPTURE_ERROR_CATALOG.E_CAP_GRANT_REVOKED
  return CAPTURE_ERROR_CATALOG.E_CAP_SCHEMA_INVALID
}

module.exports = { CAPTURE_ERROR_CATALOG, lookupCaptureError }
