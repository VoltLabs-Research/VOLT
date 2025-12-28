import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createNotificationSlice, type NotificationSlice } from './notification-slice';

export const useNotificationStore = create<NotificationSlice>()(combineSlices(createNotificationSlice));

export { type NotificationSlice, type NotificationState, type NotificationActions } from './notification-slice';
export default useNotificationStore;
