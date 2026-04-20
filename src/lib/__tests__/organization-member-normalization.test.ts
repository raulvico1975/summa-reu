import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOrganizationMember } from '../organization-member-normalization'

test('normalizeOrganizationMember applies conservative minimum contract fallbacks', () => {
  const member = normalizeOrganizationMember({}, {
    userId: 'uid-1',
    email: 'demo@example.com',
    displayName: 'Demo User',
  })

  assert.equal(member.userId, 'uid-1')
  assert.equal(member.email, 'demo@example.com')
  assert.equal(member.displayName, 'Demo User')
  assert.equal(member.role, 'viewer')
  assert.deepEqual(member.capabilities, {})
})

test('normalizeOrganizationMember preserves valid role and true capabilities', () => {
  const member = normalizeOrganizationMember({
    userId: 'uid-2',
    email: 'user@example.com',
    displayName: 'Ops User',
    role: 'user',
    capabilities: {
      'moviments.read': true,
      'fiscal.model182.generar': false,
    },
  })

  assert.equal(member.role, 'user')
  assert.deepEqual(member.capabilities, { 'moviments.read': true })
})
