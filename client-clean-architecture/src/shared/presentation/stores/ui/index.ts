import { create } from 'zustand';
import { createToastSlice } from './toast-slice';
import { createWindowsSlice } from './windows-slice';
import type { ToastSlice } from './toast-slice';
import type { WindowsSlice } from './windows-slice';

export type UIStore = ToastSlice & WindowsSlice;

export const useUIStore = create<UIStore>()((set, get, store) => ({
    ...createToastSlice(set, get, store),
    ...createWindowsSlice(set, get, store)
}));

export * from './toast-slice';
export * from './windows-slice';
