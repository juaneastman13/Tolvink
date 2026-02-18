import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api, {
  setToken, getToken, clearAuth, saveUser, getSavedUser,
  setAuthFailHandler, setLoggingIn, setRefreshToken,
} from '../api';

// Mock the sentry import
vi.mock('../sentry', () => ({
  captureError: vi.fn(),
}));

describe('Token management', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAuth();
  });

  it('setToken stores and retrieves token', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
    expect(localStorage.getItem('tolvink_token')).toBe('abc123');
  });

  it('setToken(null) removes token', () => {
    setToken('abc');
    setToken(null);
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('tolvink_token')).toBeNull();
  });

  it('clearAuth removes all auth data', () => {
    setToken('tok');
    setRefreshToken('ref');
    saveUser({ id: '1', name: 'Test' });

    clearAuth();

    expect(getToken()).toBeNull();
    expect(localStorage.getItem('tolvink_token')).toBeNull();
    expect(localStorage.getItem('tolvink_refresh_token')).toBeNull();
    expect(localStorage.getItem('tolvink_user')).toBeNull();
  });

  it('saveUser/getSavedUser round-trips', () => {
    const user = { id: '1', name: 'Juan', email: 'juan@test.com' };
    saveUser(user);
    expect(getSavedUser()).toEqual(user);
  });

  it('getSavedUser returns null for corrupt data', () => {
    localStorage.setItem('tolvink_user', '{invalid');
    expect(getSavedUser()).toBeNull();
  });

  it('getSavedUser returns null when no user stored', () => {
    expect(getSavedUser()).toBeNull();
  });
});

describe('api() function', () => {
  let fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    clearAuth();
    setToken('test-token');
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('makes GET request by default', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [1, 2, 3] }),
    });

    const result = await api('/freights');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, cfg] = fetchSpy.mock.calls[0];
    expect(url).toContain('/freights');
    expect(cfg.method).toBe('GET');
    expect(cfg.headers.Authorization).toBe('Bearer test-token');
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('makes POST request when body is provided', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: 'new-id' }),
    });

    const result = await api('/freights', { body: { grain: 'Soja' } });

    const [, cfg] = fetchSpy.mock.calls[0];
    expect(cfg.method).toBe('POST');
    expect(JSON.parse(cfg.body)).toEqual({ grain: 'Soja' });
    expect(result.id).toBe('new-id');
  });

  it('throws ApiError on non-200 response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Datos inválidos' }),
    });

    await expect(api('/freights', { body: {} })).rejects.toThrow('Datos inválidos');
  });

  it('handles JSON parse failure on error response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse fail')),
    });

    await expect(api('/test')).rejects.toThrow('Error del servidor');
  });

  it('calls authFailHandler on 401', async () => {
    const failHandler = vi.fn();
    setAuthFailHandler(failHandler);
    setLoggingIn(false);

    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    });

    await expect(api('/test')).rejects.toThrow('Sesión expirada');
    expect(failHandler).toHaveBeenCalledOnce();
  });

  it('sends request without auth header when no token', async () => {
    clearAuth();

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await api('/public-endpoint');

    const [, cfg] = fetchSpy.mock.calls[0];
    expect(cfg.headers.Authorization).toBeUndefined();
  });

  it('retries with new token after successful refresh', async () => {
    setRefreshToken('old-refresh');
    setLoggingIn(false);

    // First call: 401
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Expired' }),
    });

    // Refresh call: success
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        user: { id: '1', name: 'Test' },
      }),
    });

    // Retry call: success
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'success' }),
    });

    const result = await api('/protected');
    expect(result).toEqual({ data: 'success' });
    expect(getToken()).toBe('new-token');
  });
});
