import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../store';

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useUIStore.setState({
      modal: null, toast: null, mapFocus: null, listView: 'kanban',
      submitting: false, submitDone: '', actionLoading: false,
      notifOpen: false, chatConvId: null, duplicateData: null,
      editData: null, locPicker: null,
    });
  });

  it('initial state', () => {
    const state = useUIStore.getState();
    expect(state.modal).toBeNull();
    expect(state.toast).toBeNull();
    expect(state.listView).toBe('kanban');
    expect(state.submitting).toBe(false);
  });

  it('setModal', () => {
    useUIStore.getState().setModal({ type: 'confirm', data: {} });
    expect(useUIStore.getState().modal).toEqual({ type: 'confirm', data: {} });
  });

  it('setToast', () => {
    useUIStore.getState().setToast({ msg: 'Guardado', type: 'ok' });
    expect(useUIStore.getState().toast).toEqual({ msg: 'Guardado', type: 'ok' });
  });

  it('show helper creates toast', () => {
    useUIStore.getState().show('Éxito');
    expect(useUIStore.getState().toast).toEqual({ msg: 'Éxito', type: 'ok' });

    useUIStore.getState().show('Error', 'err');
    expect(useUIStore.getState().toast).toEqual({ msg: 'Error', type: 'err' });
  });

  it('setListView', () => {
    useUIStore.getState().setListView('tabla');
    expect(useUIStore.getState().listView).toBe('tabla');

    useUIStore.getState().setListView('mapa');
    expect(useUIStore.getState().listView).toBe('mapa');
  });

  it('setSubmitting', () => {
    useUIStore.getState().setSubmitting(true);
    expect(useUIStore.getState().submitting).toBe(true);
  });

  it('goToMap sets mapFocus correctly', () => {
    useUIStore.getState().goToMap(-34.5, -56.2, 'Campo A', -34.8, -56.5, 'Planta B');
    const mf = useUIStore.getState().mapFocus;
    expect(mf.lat).toBe(-34.5);
    expect(mf.lng).toBe(-56.2);
    expect(mf.label).toBe('Campo A');
    expect(mf.destLat).toBe(-34.8);
    expect(mf.destLng).toBe(-56.5);
    expect(mf.destLabel).toBe('Planta B');
  });

  it('goToMap ignores invalid coords', () => {
    useUIStore.getState().goToMap(null, null, 'Test');
    expect(useUIStore.getState().mapFocus).toBeNull();
  });

  it('goToMap without destination', () => {
    useUIStore.getState().goToMap(-34.5, -56.2, 'Solo origen');
    const mf = useUIStore.getState().mapFocus;
    expect(mf.lat).toBe(-34.5);
    expect(mf.destLat).toBeNull();
    expect(mf.destLng).toBeNull();
  });

  it('setChatConvId', () => {
    useUIStore.getState().setChatConvId('conv-123');
    expect(useUIStore.getState().chatConvId).toBe('conv-123');
  });

  it('setDuplicateData', () => {
    const data = { grain: 'Soja', tons: 30 };
    useUIStore.getState().setDuplicateData(data);
    expect(useUIStore.getState().duplicateData).toEqual(data);
  });
});
