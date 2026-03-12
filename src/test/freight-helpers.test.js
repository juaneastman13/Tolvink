import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveUserTypeForFreight, getPendingActions, getWaitingOnText, _timeAgo, _fmtDate } from '../utils/freight-helpers';

// Mock theme (C colors used in return values)
vi.mock('../theme', () => ({
  C: { pri: '#pri', sec: '#sec', acc: '#acc', ok: '#ok', err: '#err', info: '#info', t3: '#t3', priGhost: '#priGhost', priPale: '#priPale', bg: '#bg', b1: '#b1', b2: '#b2', t1: '#t1', t2: '#t2', bgInput: '#bgInput' },
  Ic: { truck: () => null, chk: () => null, ban: () => null, nav: () => null, bell: () => null, chev: () => null, user: () => null, plant: () => null },
}));

describe('_fmtDate', () => {
  it('formats ISO date to dd/mm/yy', () => {
    expect(_fmtDate('2024-01-15T00:00:00Z')).toBe('15/01/24');
  });

  it('returns empty string for falsy input', () => {
    expect(_fmtDate(null)).toBe('');
    expect(_fmtDate(undefined)).toBe('');
    expect(_fmtDate('')).toBe('');
  });
});

describe('_timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  it('returns "ahora" for <1 minute ago', () => {
    expect(_timeAgo('2024-06-15T11:59:30Z')).toBe('ahora');
  });

  it('returns minutes for <60 min', () => {
    expect(_timeAgo('2024-06-15T11:55:00Z')).toBe('hace 5m');
  });

  it('returns hours for <24 hours', () => {
    expect(_timeAgo('2024-06-15T09:00:00Z')).toBe('hace 3h');
  });

  it('returns days for <7 days', () => {
    expect(_timeAgo('2024-06-13T12:00:00Z')).toBe('hace 2d');
  });

  it('returns weeks for >=7 days', () => {
    expect(_timeAgo('2024-06-01T12:00:00Z')).toBe('hace 2 sem');
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe('getWaitingOnText', () => {
  describe('plant', () => {
    it('assigned non-own-fleet: waiting on transport', () => {
      expect(getWaitingOnText({ status: 'assigned', isOwnFleet: false }, 'plant')).toBe('Esperando transporte');
    });

    it('assigned own-fleet: no waiting text (plant authorizes)', () => {
      expect(getWaitingOnText({ status: 'assigned', isOwnFleet: true }, 'plant')).toBeNull();
    });

    it('accepted own-fleet: waiting for start', () => {
      expect(getWaitingOnText({ status: 'accepted', isOwnFleet: true }, 'plant')).toBe('Esperando inicio');
    });

    it('accepted non-own-fleet: waiting for transport start', () => {
      expect(getWaitingOnText({ status: 'accepted', isOwnFleet: false }, 'plant')).toBe('Esperando inicio transporte');
    });

    it('in_progress: in transit', () => {
      expect(getWaitingOnText({ status: 'in_progress' }, 'plant')).toBe('En tránsito');
    });

    it('finished: null', () => {
      expect(getWaitingOnText({ status: 'finished' }, 'plant')).toBeNull();
    });
  });

  describe('transporter', () => {
    it('assigned own-fleet: waiting plant auth', () => {
      expect(getWaitingOnText({ status: 'assigned', isOwnFleet: true }, 'transporter')).toBe('Esperando autorización planta');
    });

    it('in_progress with transporter confirmed but not producer', () => {
      expect(getWaitingOnText({ status: 'in_progress', transporterLoadedConfirmedAt: '2024-01-01', producerLoadedConfirmedAt: null }, 'transporter'))
        .toBe('Esperando confirmación productor');
    });

    it('loaded with transporter finished confirmed', () => {
      expect(getWaitingOnText({ status: 'loaded', transporterFinishedConfirmedAt: '2024-01-01' }, 'transporter'))
        .toBe('Esperando confirmación planta');
    });

    it('returns null when no waiting condition met', () => {
      expect(getWaitingOnText({ status: 'accepted' }, 'transporter')).toBeNull();
    });
  });

  describe('producer', () => {
    it('pending_assignment: waiting plant', () => {
      expect(getWaitingOnText({ status: 'pending_assignment' }, 'producer')).toBe('Esperando asignación planta');
    });

    it('assigned own-fleet: waiting plant auth', () => {
      expect(getWaitingOnText({ status: 'assigned', isOwnFleet: true }, 'producer')).toBe('Esperando autorización planta');
    });

    it('assigned non-own-fleet: waiting transport', () => {
      expect(getWaitingOnText({ status: 'assigned', isOwnFleet: false }, 'producer')).toBe('Esperando transporte');
    });

    it('accepted: waiting start', () => {
      expect(getWaitingOnText({ status: 'accepted' }, 'producer')).toBe('Esperando inicio');
    });

    it('in_progress: in transit', () => {
      expect(getWaitingOnText({ status: 'in_progress' }, 'producer')).toBe('En tránsito');
    });
  });

  it('returns null for unknown userType', () => {
    expect(getWaitingOnText({ status: 'assigned' }, 'unknown')).toBeNull();
  });
});

describe('getPendingActions (single truck)', () => {
  describe('chofer', () => {
    it('assigned: accept or reject', () => {
      const r = getPendingActions({ status: 'assigned' }, 'chofer', 'chofer', {});
      expect(r.actionKey).toBe('respond');
    });

    it('accepted: start', () => {
      const r = getPendingActions({ status: 'accepted' }, 'chofer', 'chofer', {});
      expect(r.actionKey).toBe('start');
    });

    it('in_progress: confirm loaded', () => {
      const r = getPendingActions({ status: 'in_progress' }, 'chofer', 'chofer', {});
      expect(r.actionKey).toBe('confirm_loaded');
    });

    it('loaded: confirm finished', () => {
      const r = getPendingActions({ status: 'loaded' }, 'chofer', 'chofer', {});
      expect(r.actionKey).toBe('confirm_finished');
    });

    it('finished: null', () => {
      expect(getPendingActions({ status: 'finished' }, 'chofer', 'chofer', {})).toBeNull();
    });

    it('queue position > 1 shows queue', () => {
      const r = getPendingActions({ status: 'assigned', queuePosition: 3 }, 'chofer', 'chofer', {});
      expect(r.isQueue).toBe(true);
      expect(r.action).toBe('En cola #3');
    });
  });

  describe('plant', () => {
    it('pending_assignment: assign', () => {
      const r = getPendingActions({ status: 'pending_assignment' }, 'plant', 'admin', {});
      expect(r.actionKey).toBe('assign');
    });

    it('assigned own-fleet: authorize', () => {
      const r = getPendingActions({ status: 'assigned', isOwnFleet: true }, 'plant', 'admin', {});
      expect(r.actionKey).toBe('authorize');
    });

    it('loaded without plant confirmation: confirm finished', () => {
      const r = getPendingActions({ status: 'loaded', plantFinishedConfirmedAt: null }, 'plant', 'admin', {});
      expect(r.actionKey).toBe('confirm_finished');
    });

    it('loaded with plant confirmation: null', () => {
      expect(getPendingActions({ status: 'loaded', plantFinishedConfirmedAt: '2024-01-01' }, 'plant', 'admin', {})).toBeNull();
    });
  });

  describe('transporter', () => {
    it('assigned non-own-fleet: respond', () => {
      const r = getPendingActions({ status: 'assigned', isOwnFleet: false }, 'transporter', 'admin', {});
      expect(r.actionKey).toBe('respond');
    });

    it('accepted: start', () => {
      const r = getPendingActions({ status: 'accepted' }, 'transporter', 'admin', {});
      expect(r.actionKey).toBe('start');
    });

    it('in_progress without transporter loaded: confirm loaded', () => {
      const r = getPendingActions({ status: 'in_progress', transporterLoadedConfirmedAt: null }, 'transporter', 'admin', {});
      expect(r.actionKey).toBe('confirm_loaded');
    });

    it('loaded without transporter finished: confirm finished', () => {
      const r = getPendingActions({ status: 'loaded', transporterFinishedConfirmedAt: null }, 'transporter', 'admin', {});
      expect(r.actionKey).toBe('confirm_finished');
    });
  });

  describe('producer', () => {
    it('accepted own-fleet: start', () => {
      const r = getPendingActions({ status: 'accepted', isOwnFleet: true }, 'producer', 'admin', {});
      expect(r.actionKey).toBe('start');
    });

    it('in_progress own-fleet without loaded confirm: confirm loaded', () => {
      const r = getPendingActions({ status: 'in_progress', isOwnFleet: true, transporterLoadedConfirmedAt: null }, 'producer', 'admin', {});
      expect(r.actionKey).toBe('confirm_loaded');
    });

    it('loaded without producer loaded confirm: confirm loaded', () => {
      const r = getPendingActions({ status: 'loaded', producerLoadedConfirmedAt: null }, 'producer', 'admin', {});
      expect(r.actionKey).toBe('confirm_loaded');
    });

    it('accepted non-own-fleet: null', () => {
      expect(getPendingActions({ status: 'accepted', isOwnFleet: false }, 'producer', 'admin', {})).toBeNull();
    });
  });
});

describe('resolveUserTypeForFreight', () => {
  it('returns chofer for chofer role', () => {
    expect(resolveUserTypeForFreight({}, { role: 'chofer' })).toBe('chofer');
  });

  it('returns userType for single-type user', () => {
    expect(resolveUserTypeForFreight({}, { userType: 'producer', userTypes: ['producer'] })).toBe('producer');
  });

  it('matches producer by originCompanyId', () => {
    const freight = { originCompanyId: 'c1', destCompanyId: 'c2', status: 'pending_assignment' };
    const user = { userType: 'plant', userTypes: ['producer', 'plant'], companyId: 'c1' };
    expect(resolveUserTypeForFreight(freight, user)).toBe('producer');
  });

  it('matches plant by destCompanyId', () => {
    const freight = { originCompanyId: 'c1', destCompanyId: 'c2', status: 'pending_assignment' };
    const user = { userType: 'producer', userTypes: ['producer', 'plant'], companyId: 'c2' };
    expect(resolveUserTypeForFreight(freight, user)).toBe('plant');
  });

  it('matches transporter by transporterId', () => {
    const freight = { originCompanyId: 'c1', destCompanyId: 'c2', transporterId: 'c3', status: 'assigned' };
    const user = { userType: 'producer', userTypes: ['producer', 'transporter'], companyId: 'c3' };
    expect(resolveUserTypeForFreight(freight, user)).toBe('transporter');
  });

  it('falls back to userType when no eligible type', () => {
    const freight = { originCompanyId: 'c1', destCompanyId: 'c2', status: 'draft' };
    const user = { userType: 'producer', userTypes: ['producer', 'plant'], companyId: 'c99' };
    expect(resolveUserTypeForFreight(freight, user)).toBe('producer');
  });
});
