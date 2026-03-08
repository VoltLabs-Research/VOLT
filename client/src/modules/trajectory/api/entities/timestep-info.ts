import type { SimulationCell } from '@/modules/simulation-cell/api/entities/simulation-cell';
import type { BoxBounds } from '@/modules/fractal/api/entities/fractal';

export interface TimestepInfo {
    timestep: number;
    natoms: number;
    fileId?: string;
    simulationCell?: SimulationCell;
    boxBounds?: BoxBounds;
}
