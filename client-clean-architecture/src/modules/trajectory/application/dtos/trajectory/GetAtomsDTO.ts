export interface GetAtomsInputDTO{
    trajectoryId: string;
    analysisId: string;
    timestep?: number;
    page?: number;
    limit?: number;
    exposureId?: string;
};

export interface AtomData{
    id: number;
    type: string;
    x: number;
    y: number;
    z: number;
    properties: Record<string, unknown>;
};

export interface GetAtomsOutputDTO{
    atoms: AtomData[];
    total: number;
    page: number;
    limit: number;
    columns: string[];
};
