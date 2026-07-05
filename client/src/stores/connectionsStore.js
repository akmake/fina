// client/src/stores/connectionsStore.js
//
// Saved bank connections + unattended sync (Phase 2, Import 2.0).
// Talks to /api/connections. Credentials are only ever SENT to the server
// (encrypted at rest there) and never returned — the store holds metadata only.

import { create } from 'zustand';
import api from '../utils/api';
import toast from 'react-hot-toast';

const TERMINAL = ['success', 'error', 'partial'];

export const useConnectionsStore = create((set, get) => ({
  connections: [],
  companies: [],
  loading: false,
  syncing: {}, // { [connectionId]: 'queued' | 'running' | 'success' | 'error' }

  // Which credential fields each supported institution needs (for the add form).
  fetchCompanies: async () => {
    if (get().companies.length) return;
    try {
      const { data } = await api.get('/connections/companies');
      set({ companies: data || [] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בטעינת רשימת הבנקים');
    }
  },

  fetchConnections: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/connections');
      set({ connections: data || [], loading: false });
    } catch (err) {
      set({ loading: false });
      toast.error(err.response?.data?.message || 'שגיאה בטעינת החיבורים');
    }
  },

  createConnection: async (payload) => {
    try {
      await api.post('/connections', payload);
      toast.success('החיבור נשמר! מעכשיו הסנכרון יתבצע אוטומטית');
      await get().fetchConnections();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בשמירת החיבור');
      return false;
    }
  },

  updateConnection: async (id, patch) => {
    try {
      await api.patch(`/connections/${id}`, patch);
      await get().fetchConnections();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בעדכון החיבור');
      return false;
    }
  },

  deleteConnection: async (id) => {
    try {
      await api.delete(`/connections/${id}`);
      toast.success('החיבור נמחק');
      set((s) => ({ connections: s.connections.filter((c) => c._id !== id) }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה במחיקת החיבור');
    }
  },

  // Trigger a sync now, then poll the resulting job to completion.
  syncConnection: async (id) => {
    set((s) => ({ syncing: { ...s.syncing, [id]: 'queued' } }));
    try {
      const { data } = await api.post(`/connections/${id}/sync`);
      const jobId = data.jobId;
      const job = await get()._pollJob(id, jobId);

      if (job?.status === 'success') {
        const added = job.stats?.inserted ?? 0;
        toast.success(added > 0 ? `סונכרן! נוספו ${added} עסקאות חדשות` : 'סונכרן — אין עסקאות חדשות');
      } else if (job?.status === 'error') {
        toast.error(job.error || 'הסנכרון נכשל');
      }
      await get().fetchConnections();
      return job;
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בהפעלת הסנכרון');
      return null;
    } finally {
      set((s) => {
        const next = { ...s.syncing };
        delete next[id];
        return { syncing: next };
      });
    }
  },

  // Internal: poll a job until it reaches a terminal state (or times out).
  _pollJob: async (connId, jobId, tries = 120) => {
    for (let i = 0; i < tries; i++) {
      try {
        const { data } = await api.get(`/connections/jobs/${jobId}`);
        set((s) => ({ syncing: { ...s.syncing, [connId]: data.status } }));
        if (TERMINAL.includes(data.status)) return data;
      } catch {
        // transient — keep polling
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
  },
}));
