import { create } from 'zustand';

/** Фильтры расписания. Живут в памяти и переживают переход между экранами:
 *  вернувшись из карточки приёма в список, врач видит тот же отбор. */
export const useFilters = create((set) => ({
  clinicId: null,
  showCancelled: false,
  setClinic: (clinicId: string) => set({ clinicId }),
  toggleCancelled: () => set((s) => ({ showCancelled: !s.showCancelled })),
}));
