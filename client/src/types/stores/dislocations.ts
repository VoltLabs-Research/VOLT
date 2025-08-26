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

export type DislocationFilters = {
    teamId?: string;
    trajectoryId?: string;
    analysisConfigId?: string;
    timestepFrom?: number;
    timestepTo?: number;
};

export interface DislocationState {
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

export interface DislocationActions {
    getUserDislocations: (overrides?: Partial<DislocationFilters> & { page?: number; limit?: number; sort?: string }) => Promise<void>;
    setFilters: (filters: Partial<DislocationFilters>) => void;
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
    setSort: (sort: string) => void;
    clearError: () => void;
    reset: () => void;
}

export type DislocationStore = DislocationState & DislocationActions;