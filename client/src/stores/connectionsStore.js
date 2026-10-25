// client/src/stores/connectionsStore.js
//
// Saved bank connections + unattended sync (Import 2.0) and the paired phones
// that relay CAL SMS codes. Talks to /api/connections and /api/devices.
// Credentials are only ever SENT to the server (encrypted at rest there) and
// never returned — the store holds metadata only.

import { create } from 'zustand';
import api from '../utils/api';
import toast from 'react-hot-toast';

const TERMINAL = ['success', 'error', 'partial'];
const POLL_MS = 2000;
// CAL waits up to 10 min for the SMS code — poll a little longer than that.
const MAX_POLLS = 330;

export const useConnectionsStore = create((set, get) => ({
  connections: [],
  companies: [],
  devices: [],
  loading: false,
  syncing: {},    // { [connectionId]: 'queued' | 'running' | 'awaiting_otp' }
  jobInfo: {},    // { [connectionId]: { maskedPhone, otpExpiresAt } } from the latest poll
  activeJobs: {}, // { [connectionId]: jobId } — the job being followed on this page

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

  fetchConnections: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true });
    try {
      const { data } = await api.get('/connections');
      set({ connections: data || [], loading: false });
    } catch (err) {
      set({ loading: false });
      if (!silent) toast.error(err.response?.data?.message || 'שגיאה בטעינת החיבורים');
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
      await get().fetchConnections({ silent: true });
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בעדכון החיבור');
      return false;
    }
  },

  deleteConnection: async (id) => {
    try {
      await api.delete(`/connections/${id}`);
      toast.success('החיבור נמחק והפרטים השמורים הוסרו');
      set((s) => ({ connections: s.connections.filter((c) => c._id !== id) }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה במחיקת החיבור');
    }
  },

  // Trigger a sync now, then follow the resulting job to completion.
  syncConnection: async (id) => {
    set((s) => ({ syncing: { ...s.syncing, [id]: 'queued' } }));
    let jobId;
    try {
      const { data } = await api.post(`/connections/${id}/sync`);
      jobId = data.jobId;
    } catch (err) {
      // 409 = a sync is already running for this connection → follow that one.
      if (err.response?.status === 409 && err.response.data?.jobId) {
        jobId = err.response.data.jobId;
      } else {
        toast.error(err.response?.data?.message || 'שגיאה בהפעלת הסנכרון');
        get()._clearSync(id);
        return null;
      }
    }
    return get().followJob(id, jobId);
  },

  // Follow an existing job (e.g. a scheduled CAL sync waiting for its code).
  followJob: async (connId, jobId) => {
    // Already following this job (e.g. React StrictMode double effect) → one poller only.
    if (get().activeJobs[connId] === String(jobId)) return null;
    set((s) => ({ activeJobs: { ...s.activeJobs, [connId]: String(jobId) } }));
    try {
      const job = await get()._pollJob(connId, jobId);
      if (job?.status === 'success') {
        const added = job.stats?.inserted ?? 0;
        toast.success(added > 0 ? `סונכרן! נוספו ${added} עסקאות חדשות` : 'סונכרן — אין עסקאות חדשות');
      } else if (job?.status === 'error') {
        toast.error(job.error || 'הסנכרון נכשל');
      }
      await get().fetchConnections({ silent: true });
      return job;
    } finally {
      get()._clearSync(connId);
    }
  },

  // Web fallback: type the SMS code instead of the phone relaying it.
  submitOtp: async (connId, jobId, code) => {
    try {
      await api.post(`/connections/jobs/${jobId}/otp`, { code });
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'הקוד לא התקבל');
      return false;
    }
  },

  _clearSync: (id) => set((s) => {
    const syncing = { ...s.syncing };
    const activeJobs = { ...s.activeJobs };
    delete syncing[id];
    delete activeJobs[id];
    return { syncing, activeJobs };
  }),

  // Internal: poll a job until it reaches a terminal state (or times out).
  _pollJob: async (connId, jobId, tries = MAX_POLLS) => {
    for (let i = 0; i < tries; i++) {
      try {
        const { data } = await api.get(`/connections/jobs/${jobId}`);
        set((s) => ({
          syncing: { ...s.syncing, [connId]: data.status },
          jobInfo: { ...s.jobInfo, [connId]: { maskedPhone: data.maskedPhone, otpExpiresAt: data.otpExpiresAt, runsOn: data.runsOn, deviceStage: data.deviceStage } },
        }));
        if (TERMINAL.includes(data.status)) return data;
      } catch {
        // transient — keep polling
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    return null;
  },

  // ── Paired phones (CAL SMS relay) ──────────────────────────────────────
  fetchDevices: async () => {
    try {
      const { data } = await api.get('/devices');
      set({ devices: data || [] });
    } catch {
      set({ devices: [] });
    }
  },

  // Returns the one-time token to show the user, or null.
  pairDevice: async (name) => {
    try {
      const { data } = await api.post('/devices', { name });
      await get().fetchDevices();
      return { token: data.token, qr: data.qr };
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בצימוד המכשיר');
      return null;
    }
  },

  revokeDevice: async (id) => {
    try {
      await api.delete(`/devices/${id}`);
      toast.success('הצימוד בוטל');
      set((s) => ({ devices: s.devices.filter((d) => d._id !== id) }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בביטול הצימוד');
    }
  },
}));
