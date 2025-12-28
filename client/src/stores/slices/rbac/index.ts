import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createRBACSlice, type RBACSlice } from './rbac-slice';

export const useRBACStore = create<RBACSlice>()(combineSlices(createRBACSlice));

export { type RBACSlice, type RBACState, type RBACActions } from './rbac-slice';
export default useRBACStore;
