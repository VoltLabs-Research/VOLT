import { create } from 'zustand';
import { createDashboardSearchSlice, type DashboardSearchSlice } from './dashboard-search-slice';
import { createEditorUISlice, type EditorUISlice } from './editor-slice';
import { createToastSlice, type ToastSlice } from './toast-slice';
import { createWindowsSlice, type WindowsSlice } from './windows-slice';

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
export type { DashboardSearchState, DashboardSearchActions, DashboardSearchSlice } from './dashboard-search-slice';
export type { EditorUIState, EditorUIActions, EditorUISlice, ActiveModifier } from './editor-slice';
export type { ToastState, ToastActions, ToastSlice, Toast, ToastType } from './toast-slice';
export type { WindowsState, WindowsActions, WindowsSlice } from './windows-slice';

export default useUIStore;

