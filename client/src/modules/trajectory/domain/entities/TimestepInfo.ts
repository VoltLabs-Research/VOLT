import type { BoxBounds } from '@/modules/fractal/presentation/types';
import type { SimulationCell } from '@/modules/simulation-cell/domain/entities';

export interface TimestepInfo{
    timestep: number;
    natoms: number;
    fileId?: string;
    simulationCell?: SimulationCell;
    boxBounds?: BoxBounds;
};
