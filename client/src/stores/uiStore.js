import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const applyDarkMode = (isDark) => {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

export const useUIStore = create(
  devtools(
    persist(
      (set) => ({
        isDark: false,

        toggleDark: () =>
          set((state) => {
            const next = !state.isDark;
            applyDarkMode(next);
            return { isDark: next };
          }),

        setDark: (isDark) => {
          applyDarkMode(isDark);
          set({ isDark });
        },
      }),
      { name: 'fina-ui-preferences' }
    ),
    { name: 'UI Store' }
  )
);

// Apply persisted preference immediately on module load
try {
  const stored = JSON.parse(localStorage.getItem('fina-ui-preferences') || '{}');
  if (stored?.state?.isDark) applyDarkMode(true);
} catch (_) {
  // ignore
}
