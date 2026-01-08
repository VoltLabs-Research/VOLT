import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createAuthSlice, type AuthSlice } from './slice';

export const useAuthStore = create<AuthSlice>()(combineSlices(createAuthSlice));

useAuthStore.getState().initializeAuth();

export { type AuthSlice, type AuthState, type AuthActions } from './slice';
export default useAuthStore;
