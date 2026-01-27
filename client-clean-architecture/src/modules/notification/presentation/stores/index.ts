import { create } from 'zustand';
import { createNotificationSlice } from './slice';
import type { NotificationSlice } from './slice';

export type NotificationStore = NotificationSlice;

export const useNotificationStore = create<NotificationStore>()((set, get, store) => ({
    ...createNotificationSlice(set, get, store)
}));

export default useNotificationStore;

export * from './slice';
