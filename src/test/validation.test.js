import { describe, it, expect } from 'vitest';
import { V, validate, SCHEMAS, textMatch } from '../validation';

describe('V validators', () => {
  describe('V.req', () => {
    it('returns error for empty string', () => {
      expect(V.req('', 'Campo')).toBe('Campo es obligatorio');
    });
    it('returns error for whitespace only', () => {
      expect(V.req('   ', 'Campo')).toBe('Campo es obligatorio');
    });
    it('returns error for null/undefined', () => {
      expect(V.req(null, 'Campo')).toBe('Campo es obligatorio');
      expect(V.req(undefined, 'Campo')).toBe('Campo es obligatorio');
    });
    it('returns null for valid value', () => {
      expect(V.req('hello', 'Campo')).toBeNull();
    });
  });

  describe('V.email', () => {
    it('rejects empty', () => {
      expect(V.email('')).toBe('Email es obligatorio');
    });
    it('rejects invalid format', () => {
      expect(V.email('notanemail')).toBe('Email inválido');
      expect(V.email('missing@domain')).toBe('Email inválido');
    });
    it('accepts valid email', () => {
      expect(V.email('user@example.com')).toBeNull();
      expect(V.email('test@domain.co')).toBeNull();
    });
  });

  describe('V.min', () => {
    const min3 = V.min(3);
    it('rejects empty', () => {
      expect(min3('', 'Nombre')).toBe('Nombre es obligatorio');
    });
    it('rejects too short', () => {
      expect(min3('ab', 'Nombre')).toBe('Nombre: mínimo 3 caracteres');
    });
    it('accepts at minimum', () => {
      expect(min3('abc', 'Nombre')).toBeNull();
    });
    it('accepts longer', () => {
      expect(min3('abcdef', 'Nombre')).toBeNull();
    });
  });

  describe('V.posNum', () => {
    it('rejects empty', () => {
      expect(V.posNum('', 'Toneladas')).toBe('Toneladas es obligatorio');
      expect(V.posNum(null, 'Toneladas')).toBe('Toneladas es obligatorio');
    });
    it('rejects zero', () => {
      expect(V.posNum(0, 'Toneladas')).toBe('Toneladas debe ser mayor a 0');
    });
    it('rejects negative', () => {
      expect(V.posNum(-5, 'Toneladas')).toBe('Toneladas debe ser mayor a 0');
    });
    it('accepts positive', () => {
      expect(V.posNum(10, 'Toneladas')).toBeNull();
      expect(V.posNum('3.5', 'Toneladas')).toBeNull();
    });
  });

  describe('V.sel', () => {
    it('rejects empty', () => {
      expect(V.sel('', 'grano')).toBe('Seleccioná grano');
      expect(V.sel(null, 'grano')).toBe('Seleccioná grano');
    });
    it('accepts value', () => {
      expect(V.sel('Soja', 'grano')).toBeNull();
    });
  });

  describe('V.time', () => {
    it('rejects empty', () => {
      expect(V.time('', 'Hora')).toBe('Hora es obligatorio');
    });
    it('rejects invalid format', () => {
      expect(V.time('9:30', 'Hora')).toBe('Hora inválido');
      expect(V.time('abc', 'Hora')).toBe('Hora inválido');
    });
    it('accepts valid time', () => {
      expect(V.time('09:30', 'Hora')).toBeNull();
      expect(V.time('23:59', 'Hora')).toBeNull();
    });
  });

  describe('V.phone', () => {
    it('rejects empty', () => {
      expect(V.phone('')).toBe('Teléfono es obligatorio');
    });
    it('rejects invalid format', () => {
      expect(V.phone('12345')).toBe('Formato: 09X XXX XXX');
      expect(V.phone('08012345')).toBe('Formato: 09X XXX XXX');
    });
    it('accepts valid UY phone', () => {
      expect(V.phone('091234567')).toBeNull();
    });
    it('accepts with spaces/dashes', () => {
      expect(V.phone('091 234 567')).toBeNull();
      expect(V.phone('091-234-567')).toBeNull();
    });
  });

  describe('V.userTypes', () => {
    it('rejects empty array', () => {
      expect(V.userTypes([])).toBe('Seleccioná al menos un tipo');
    });
    it('rejects null/undefined', () => {
      expect(V.userTypes(null)).toBe('Seleccioná al menos un tipo');
      expect(V.userTypes(undefined)).toBe('Seleccioná al menos un tipo');
    });
    it('accepts non-empty array', () => {
      expect(V.userTypes(['producer'])).toBeNull();
    });
  });
});

describe('validate', () => {
  it('returns ok:true for valid login', () => {
    const result = validate({ email: 'test@example.com' }, SCHEMAS.login);
    expect(result.ok).toBe(true);
    expect(result.errs.email).toBeNull();
  });

  it('returns ok:false for invalid login', () => {
    const result = validate({ email: 'bad' }, SCHEMAS.login);
    expect(result.ok).toBe(false);
    expect(result.errs.email).toBe('Email inválido');
  });

  it('validates signup schema', () => {
    const valid = validate(
      { name: 'Juan', email: 'juan@test.com', phone: '091234567', userTypes: ['producer'] },
      SCHEMAS.signup
    );
    expect(valid.ok).toBe(true);

    const invalid = validate(
      { name: 'J', email: 'bad', phone: '123', userTypes: [] },
      SCHEMAS.signup
    );
    expect(invalid.ok).toBe(false);
    expect(invalid.errs.name).toContain('mínimo 3');
    expect(invalid.errs.email).toBe('Email inválido');
    expect(invalid.errs.phone).toBe('Formato: 09X XXX XXX');
    expect(invalid.errs.userTypes).toBe('Seleccioná al menos un tipo');
  });

  it('stops at first error per field', () => {
    const result = validate({ name: '' }, { name: [V.req, V.min(3)] });
    expect(result.errs.name).toBe('name es obligatorio');
  });
});

describe('textMatch', () => {
  it('returns true for empty needle', () => {
    expect(textMatch('anything', '')).toBe(true);
    expect(textMatch('anything', null)).toBe(true);
  });

  it('returns false for null haystack', () => {
    expect(textMatch(null, 'search')).toBe(false);
  });

  it('case insensitive match', () => {
    expect(textMatch('Hello World', 'hello')).toBe(true);
    expect(textMatch('Hello World', 'WORLD')).toBe(true);
  });

  it('trims needle', () => {
    expect(textMatch('Hello', '  Hello  ')).toBe(true);
  });

  it('returns false for no match', () => {
    expect(textMatch('Hello', 'xyz')).toBe(false);
  });

  it('converts numbers', () => {
    expect(textMatch(123, '12')).toBe(true);
  });
});
