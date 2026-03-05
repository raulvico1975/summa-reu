import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewFinancialDashboard } from '@/lib/can-view-financial-dashboard';

test('canViewFinancialDashboard: undefined -> false', () => {
  assert.equal(canViewFinancialDashboard(undefined), false);
});

test('canViewFinancialDashboard: null -> false', () => {
  assert.equal(canViewFinancialDashboard(null), false);
});

test('canViewFinancialDashboard: moviments.read=true -> true', () => {
  assert.equal(canViewFinancialDashboard({ 'moviments.read': true }), true);
});

test('canViewFinancialDashboard: moviments.importarExtractes=true -> true', () => {
  assert.equal(
    canViewFinancialDashboard({ 'moviments.importarExtractes': true }),
    true
  );
});

test('canViewFinancialDashboard: moviments.editar=true -> true', () => {
  assert.equal(canViewFinancialDashboard({ 'moviments.editar': true }), true);
});

test('canViewFinancialDashboard: moviments.lectura=true (compat) -> true', () => {
  assert.equal(canViewFinancialDashboard({ 'moviments.lectura': true }), true);
});

test('canViewFinancialDashboard: no keys -> false', () => {
  assert.equal(canViewFinancialDashboard({ other: true }), false);
});
