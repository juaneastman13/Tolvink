import { describe, it, expect } from 'vitest';
import { STATUS_LIGHT, stCfg, getActions, GRANOS, UNITS } from '../constants';

describe('STATUS_LIGHT', () => {
  it('has all 8 freight statuses', () => {
    const expected = ['draft', 'pending_assignment', 'assigned', 'accepted', 'in_progress', 'loaded', 'finished', 'canceled'];
    expect(Object.keys(STATUS_LIGHT)).toEqual(expected);
  });

  it('each status has label, color, bg, border', () => {
    Object.values(STATUS_LIGHT).forEach(s => {
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('color');
      expect(s).toHaveProperty('bg');
      expect(s).toHaveProperty('border');
      expect(s.color).toMatch(/^#/);
    });
  });
});

describe('stCfg', () => {
  it('returns config for valid status', () => {
    expect(stCfg('draft')).toEqual(STATUS_LIGHT.draft);
    expect(stCfg('finished')).toEqual(STATUS_LIGHT.finished);
  });

  it('falls back to pending_assignment for unknown status', () => {
    expect(stCfg('nonexistent')).toEqual(STATUS_LIGHT.pending_assignment);
    expect(stCfg(undefined)).toEqual(STATUS_LIGHT.pending_assignment);
  });
});

describe('getActions', () => {
  describe('pending_assignment', () => {
    it('producer can cancel', () => {
      expect(getActions('pending_assignment', 'producer', 'admin')).toEqual(['cancel']);
    });
    it('plant can assign and cancel', () => {
      expect(getActions('pending_assignment', 'plant', 'admin')).toEqual(['assign', 'cancel']);
    });
    it('transporter has no actions', () => {
      expect(getActions('pending_assignment', 'transporter', 'admin')).toEqual([]);
    });
  });

  describe('assigned', () => {
    it('transporter can accept or reject', () => {
      expect(getActions('assigned', 'transporter', 'admin', false)).toEqual(['accept', 'reject']);
    });
    it('plant can authorize own fleet', () => {
      expect(getActions('assigned', 'plant', 'admin', true)).toEqual(['authorize', 'cancel']);
    });
  });

  describe('accepted', () => {
    it('transporter can start (not own fleet)', () => {
      expect(getActions('accepted', 'transporter', 'admin', false)).toEqual(['start', 'cancel']);
    });
    it('producer can start own fleet', () => {
      expect(getActions('accepted', 'producer', 'admin', true)).toEqual(['start', 'cancel']);
    });
  });

  describe('in_progress', () => {
    it('transporter can confirm loaded (not own fleet)', () => {
      expect(getActions('in_progress', 'transporter', 'admin', false)).toEqual(['confirm_loaded']);
    });
    it('producer can confirm loaded (own fleet)', () => {
      expect(getActions('in_progress', 'producer', 'admin', true)).toEqual(['confirm_loaded']);
    });
  });

  describe('loaded', () => {
    it('plant can confirm finished', () => {
      expect(getActions('loaded', 'plant', 'admin')).toEqual(['confirm_finished']);
    });
    it('producer can confirm loaded', () => {
      expect(getActions('loaded', 'producer', 'admin')).toEqual(['confirm_loaded']);
    });
  });

  describe('finished/canceled', () => {
    it('no actions for finished', () => {
      expect(getActions('finished', 'producer', 'admin')).toEqual([]);
      expect(getActions('finished', 'plant', 'admin')).toEqual([]);
      expect(getActions('finished', 'transporter', 'admin')).toEqual([]);
    });
    it('no actions for canceled', () => {
      expect(getActions('canceled', 'producer', 'admin')).toEqual([]);
    });
  });

  describe('unknown status/type', () => {
    it('returns empty array for unknown status', () => {
      expect(getActions('unknown', 'producer', 'admin')).toEqual([]);
    });
    it('returns empty array for unknown userType', () => {
      expect(getActions('pending_assignment', 'unknown', 'admin')).toEqual([]);
    });
  });
});

describe('GRANOS', () => {
  it('has 7 grain types', () => {
    expect(GRANOS).toHaveLength(7);
    expect(GRANOS).toContain('Soja');
    expect(GRANOS).toContain('Trigo');
    expect(GRANOS).toContain('Otros');
  });
});

describe('UNITS', () => {
  it('has 4 unit types', () => {
    expect(UNITS).toHaveLength(4);
    expect(UNITS[0]).toEqual({ v: 'toneladas', l: 'Toneladas' });
  });
});
