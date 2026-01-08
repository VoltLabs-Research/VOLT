import { create } from 'zustand';
import { createDashboardSearchSlice, type DashboardSearchSlice } from '@/stores/slices/ui/dashboard-search-slice';
import { createEditorUISlice, type EditorUISlice } from '@/features/canvas/stores/ui/editor-slice';
import { createToastSlice, type ToastSlice } from '@/stores/slices/ui/toast-slice';
import { createWindowsSlice, type WindowsSlice } from '@/stores/slices/ui/windows-slice';

// Combined UI Store Type
export type UISlice = DashboardSearchSlice & EditorUISlice & ToastSlice & WindowsSlice;

// Create combined UI store
export const useUIStore = create<UISlice>()((...args) => ({
    ...createDashboardSearchSlice(...args),
    ...createEditorUISlice(...args),
    ...createToastSlice(...args),
    ...createWindowsSlice(...args)
}));

// Re-export types
export type { DashboardSearchState, DashboardSearchActions, DashboardSearchSlice } from '@/stores/slices/ui/dashboard-search-slice';
export type { EditorUIState, EditorUIActions, EditorUISlice, ActiveModifier } from '@/features/canvas/stores/ui/editor-slice';
export type { ToastState, ToastActions, ToastSlice, Toast, ToastType } from '@/stores/slices/ui/toast-slice';
export type { WindowsState, WindowsActions, WindowsSlice } from '@/stores/slices/ui/windows-slice';

export default useUIStore;

