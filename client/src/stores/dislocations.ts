/**
 * Copyright (C) Rodolfo...
 * (mismo header que el resto del proyecto)
 */

import { create } from 'zustand';
import { api } from '@/services/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { ApiResponse } from '@/types/api';

export interface DislocationDoc {
  _id: string;
  trajectory: { _id: string; name: string; team?: string } | string;
  analysisConfig?: { _id: string; crystalStructure?: string; identificationMode?: string } | string;
  timestep: number;
  totalSegments: number;
  totalPoints: number;
  averageSegmentLength: number;
  maxSegmentLength: number;
  minSegmentLength: number;
  totalLength: number;
  createdAt: string;
  updatedAt: string;
}

export interface DislocationTotals {
  segments: number;
  points: number;
  length: number;
}

export interface DislocationsResponse {
  page: number;
  limit: number;
  total: number;
  totals: DislocationTotals;
  dislocations: DislocationDoc[];
}

type DislocationFilters = {
  teamId?: string;
  trajectoryId?: string;
  analysisConfigId?: string;
  timestepFrom?: number;
  timestepTo?: number;
};

interface DislocationState {
  dislocations: DislocationDoc[];
  isLoading: boolean;
  error: string | null;

  page: number;
  limit: number;
  total: number;
  sort: string;

  totals: DislocationTotals;
  filters: DislocationFilters;
}

interface DislocationActions {
  getUserDislocations: (overrides?: Partial<DislocationFilters> & { page?: number; limit?: number; sort?: string }) => Promise<void>;
  setFilters: (filters: Partial<DislocationFilters>) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSort: (sort: string) => void;
  clearError: () => void;
  reset: () => void;
}

export type DislocationStore = DislocationState & DislocationActions;

const initialState: DislocationState = {
  dislocations: [],
  isLoading: false,
  error: null,

  page: 1,
  limit: 100,
  total: 0,
  sort: '-createdAt',

  totals: { segments: 0, points: 0, length: 0 },
  filters: {}
};

const useDislocationStore = create<DislocationStore>()((set, get) => {
  const asyncAction = createAsyncAction(set, get);

  return {
    ...initialState,

    getUserDislocations: (overrides = {}) => {
      const { page, limit, sort, ...extra } = overrides;
      const nextPage = page ?? get().page;
      const nextLimit = limit ?? get().limit;
      const nextSort = sort ?? get().sort;
      const nextFilters = { ...get().filters, ...extra };

      // Persist local state for pagination/filters
      set({
        page: nextPage,
        limit: nextLimit,
        sort: nextSort,
        filters: nextFilters
      });

      return asyncAction(
        () =>
          api.get<ApiResponse<DislocationsResponse>>('/dislocations', {
            params: {
              ...nextFilters,
              page: nextPage,
              limit: nextLimit,
              sort: nextSort
            }
          }),
        {
          loadingKey: 'isLoading',
          onSuccess: (res) => {
            const payload = res.data.data;
            return {
              dislocations: payload.dislocations,
              total: payload.total,
              totals: payload.totals,
              page: payload.page,
              limit: payload.limit,
              error: null
            };
          },
          onError: (error) => ({
            error: error?.response?.data?.message || 'Failed to load dislocations'
          })
        }
      );
    },

    setFilters: (filters) => set({ filters: { ...get().filters, ...filters } }),
    setPage: (page) => set({ page }),
    setLimit: (limit) => set({ limit }),
    setSort: (sort) => set({ sort }),

    clearError: () => set({ error: null }),

    reset: () => set(initialState)
  };
});

export default useDislocationStore;
