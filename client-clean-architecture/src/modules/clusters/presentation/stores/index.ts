import { create } from 'zustand';
import { createClusterSlice } from './slice';
import type { ClusterSlice } from './slice';

export type ClusterStore = ClusterSlice;

export const useClusterStore = create<ClusterStore>()((set, get, store) => ({
    ...createClusterSlice(set, get, store)
}));

export * from './slice';
