import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createNotificationSlice, type NotificationSlice } from '@/features/notification/stores/notification-slice';

export const useNotificationStore = create<NotificationSlice>()(combineSlices(createNotificationSlice));

export { type NotificationSlice, type NotificationState, type NotificationActions } from '@/features/notification/stores/notification-slice';
export default useNotificationStore;
