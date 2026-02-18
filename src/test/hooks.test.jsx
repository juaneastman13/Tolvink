import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapUser, mapFreight, permsFor } from '../hooks';

describe('mapUser', () => {
  it('returns null for null input', () => {
    expect(mapUser(null)).toBeNull();
    expect(mapUser(undefined)).toBeNull();
  });

  it('maps basic user correctly', () => {
    const raw = {
      id: 'u1', email: 'test@test.com', phone: '091234567',
      name: 'Juan Pérez', role: 'operario',
      company: { id: 'c1', name: 'Empresa A', type: 'producer', hasInternalFleet: false },
    };
    const mapped = mapUser(raw);
    expect(mapped.id).toBe('u1');
    expect(mapped.email).toBe('test@test.com');
    expect(mapped.name).toBe('Juan Pérez');
    expect(mapped.role).toBe('operario');
    expect(mapped.userType).toBe('producer');
    expect(mapped.entity).toBe('Empresa A');
    expect(mapped.av).toBe('JP');
    expect(mapped.isSuperAdmin).toBe(false);
  });

  it('maps gerente → admin', () => {
    const raw = {
      id: 'u2', name: 'Admin User', role: 'gerente',
      company: { id: 'c1', name: 'Test', type: 'plant' },
    };
    const mapped = mapUser(raw);
    expect(mapped.role).toBe('admin');
  });

  it('preserves platform_admin role', () => {
    const raw = {
      id: 'u3', name: 'Super Admin', role: 'platform_admin',
      company: { id: 'c1', name: 'Platform', type: 'plant' },
      isSuperAdmin: true,
    };
    const mapped = mapUser(raw);
    expect(mapped.role).toBe('platform_admin');
    expect(mapped.isSuperAdmin).toBe(true);
  });

  it('generates avatar from name initials', () => {
    expect(mapUser({ id: '1', name: 'Ana Belén Castro' }).av).toBe('AB');
    expect(mapUser({ id: '2', name: 'Juan' }).av).toBe('J'); // single word = 1 initial
    expect(mapUser({ id: '3' }).av).toBe('U'); // "Usuario" default = 1 initial
    expect(mapUser({ id: '4', name: 'María López' }).av).toBe('ML');
  });

  it('handles missing company', () => {
    const mapped = mapUser({ id: 'u4', name: 'NoCompany' });
    expect(mapped.entity).toBe('');
    expect(mapped.companyId).toBe('');
    expect(mapped.userType).toBe('producer'); // default
  });

  it('maps companies with effectiveRole', () => {
    const raw = {
      id: 'u5', name: 'Multi User',
      companies: [
        { id: 'c1', name: 'Co1', role: 'gerente' },
        { id: 'c2', name: 'Co2', role: 'operario' },
      ],
    };
    const mapped = mapUser(raw);
    expect(mapped.companies).toHaveLength(2);
    expect(mapped.companies[0].effectiveRole).toBe('admin');
    expect(mapped.companies[1].effectiveRole).toBe('operario');
  });
});

describe('mapFreight', () => {
  it('returns null for null input', () => {
    expect(mapFreight(null)).toBeNull();
    expect(mapFreight(undefined)).toBeNull();
  });

  it('maps basic freight', () => {
    const raw = {
      id: 'f1', code: 'FLT-0001', status: 'pending_assignment',
      items: [{ grain: 'Soja', tons: 30, unit: 'toneladas', amount: 0 }],
      originName: 'Campo Norte', originCompanyId: 'c1',
      originCompany: { name: 'Productor SA' },
      destName: 'Planta Sur', destPlantId: 'p1',
      loadDate: '2024-01-15T00:00:00Z', loadTime: '08:00',
      notes: 'Urgente', createdAt: '2024-01-10',
      assignments: [],
    };
    const mapped = mapFreight(raw);
    expect(mapped.code).toBe('FLT-0001');
    expect(mapped.grain).toBe('Soja');
    expect(mapped.tons).toBe(30);
    expect(mapped.originName).toBe('Campo Norte');
    expect(mapped.destName).toBe('Planta Sur');
    expect(mapped.loadDate).toBe('2024-01-15');
    expect(mapped.isOwnFleet).toBe(false);
    expect(mapped.transporterName).toBe('');
  });

  it('detects own fleet', () => {
    const raw = {
      id: 'f2', code: 'FLT-0002', status: 'assigned',
      originCompanyId: 'c1',
      assignments: [{ status: 'active', transportCompanyId: 'c1', transportCompany: { name: 'Own' } }],
      items: [{ grain: 'Trigo', tons: 20 }],
    };
    const mapped = mapFreight(raw);
    expect(mapped.isOwnFleet).toBe(true);
    expect(mapped.transporterName).toBe('Own');
  });

  it('extracts driver and truck info from active assignment', () => {
    const raw = {
      id: 'f3', code: 'FLT-0003', status: 'accepted',
      originCompanyId: 'c1',
      assignments: [
        { status: 'rejected', transportCompanyId: 'c2', transportCompany: { name: 'Rejected' } },
        { status: 'accepted', transportCompanyId: 'c3', transportCompany: { name: 'Trans Co' },
          driver: { name: 'Carlos', phone: '091111111' },
          truck: { plate: 'ABC1234', model: 'Volvo' } },
      ],
      items: [{ grain: 'Maíz', tons: 25 }],
    };
    const mapped = mapFreight(raw);
    expect(mapped.transporterName).toBe('Trans Co');
    expect(mapped.driverName).toBe('Carlos');
    expect(mapped.truckPlate).toBe('ABC1234');
  });

  it('handles missing items gracefully', () => {
    const mapped = mapFreight({ id: 'f4', code: 'X', status: 'draft', items: [] });
    expect(mapped.grain).toBe('');
    expect(mapped.tons).toBe(0);
  });

  it('parses lat/lng as numbers', () => {
    const mapped = mapFreight({
      id: 'f5', code: 'X', status: 'draft',
      originLat: '-34.5', originLng: '-56.2',
      destLat: '-34.8', destLng: '-56.5',
      items: [],
    });
    expect(mapped.originLat).toBe(-34.5);
    expect(mapped.originLng).toBe(-56.2);
    expect(mapped.destLat).toBe(-34.8);
    expect(mapped.destLng).toBe(-56.5);
  });
});

describe('permsFor', () => {
  it('returns empty object for null user', () => {
    expect(permsFor(null)).toEqual({});
    expect(permsFor(undefined)).toEqual({});
  });

  it('producer admin permissions', () => {
    const perms = permsFor({ role: 'admin', userType: 'producer' });
    expect(perms.canRequest).toBe(true);
    expect(perms.canApprove).toBe(false);
    expect(perms.canAssignDriver).toBe(false);
    expect(perms.canCancel).toBe(true);
  });

  it('plant admin permissions', () => {
    const perms = permsFor({ role: 'admin', userType: 'plant' });
    expect(perms.canRequest).toBe(true);
    expect(perms.canApprove).toBe(true);
    expect(perms.canAssignDriver).toBe(false);
    expect(perms.canCancel).toBe(true);
  });

  it('transporter admin permissions', () => {
    const perms = permsFor({ role: 'admin', userType: 'transporter' });
    expect(perms.canRequest).toBe(false);
    expect(perms.canApprove).toBe(false);
    expect(perms.canAssignDriver).toBe(true);
    expect(perms.canCancel).toBe(true);
    expect(perms.canReject).toBe(true);
  });

  it('operario has limited permissions', () => {
    const perms = permsFor({ role: 'operario', userType: 'producer' });
    expect(perms.canRequest).toBe(true);
    expect(perms.canCancel).toBe(false);
  });

  it('plant operario cannot approve', () => {
    const perms = permsFor({ role: 'operario', userType: 'plant' });
    expect(perms.canRequest).toBe(true);
    expect(perms.canApprove).toBe(false);
  });

  it('platform_admin has cancel access', () => {
    const perms = permsFor({ role: 'platform_admin', userType: 'plant' });
    expect(perms.canCancel).toBe(true);
    expect(perms.canApprove).toBe(true);
  });
});
