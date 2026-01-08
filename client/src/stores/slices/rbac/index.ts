import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createRBACSlice, type RBACSlice } from '@/stores/slices/rbac/rbac-slice';

export const useRBACStore = create<RBACSlice>()(combineSlices(createRBACSlice));

export { type RBACSlice, type RBACState, type RBACActions } from '@/stores/slices/rbac/rbac-slice';
export default useRBACStore;
