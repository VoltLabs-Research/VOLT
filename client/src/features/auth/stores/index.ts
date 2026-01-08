import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createAuthSlice, type AuthSlice } from '@/features/auth/stores/slice';

export const useAuthStore = create<AuthSlice>()(combineSlices(createAuthSlice));

useAuthStore.getState().initializeAuth();

export { type AuthSlice, type AuthState, type AuthActions } from '@/features/auth/stores/slice';
export default useAuthStore;
