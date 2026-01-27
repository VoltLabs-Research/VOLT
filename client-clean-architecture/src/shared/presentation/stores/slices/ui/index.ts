import { create } from 'zustand';
import { createDashboardSearchSlice, type DashboardSearchSlice } from '@/shared/presentation/stores/slices/ui/dashboard-search-slice';
import { createEditorUISlice, type EditorUISlice } from '@/modules/canvas/presentation/stores/ui/editor-slice';
import { createToastSlice, type ToastSlice } from '@/shared/presentation/stores/slices/ui/toast-slice';
import { createWindowsSlice, type WindowsSlice } from '@/shared/presentation/stores/slices/ui/windows-slice';

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
export type { DashboardSearchState, DashboardSearchActions, DashboardSearchSlice } from '@/shared/presentation/stores/slices/ui/dashboard-search-slice';
export type { EditorUIState, EditorUIActions, EditorUISlice } from '@/modules/canvas/presentation/stores/ui/editor-slice';
export type { ActiveModifier } from '@/modules/canvas/domain/entities/ActiveModifier';
export type { ToastState, ToastActions, ToastSlice, Toast, ToastType } from '@/shared/presentation/stores/slices/ui/toast-slice';
export type { WindowsState, WindowsActions, WindowsSlice } from '@/shared/presentation/stores/slices/ui/windows-slice';

export default useUIStore;
