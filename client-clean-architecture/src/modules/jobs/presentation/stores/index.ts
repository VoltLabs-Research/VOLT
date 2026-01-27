import { create } from 'zustand';
import { createJobSlice } from './slice';
import type { JobSlice } from './slice';

export type JobStore = JobSlice;

export const useJobStore = create<JobStore>()((set, get, store) => ({
    ...createJobSlice(set, get, store)
}));

export * from './slice';
