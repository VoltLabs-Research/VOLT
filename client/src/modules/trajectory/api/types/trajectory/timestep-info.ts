import type { SimulationCell } from '@/modules/simulation-cell/api/types/simulation-cell';
import type { BoxBounds } from '@/modules/fractal/api/types/model';

export interface TimestepInfo {
    timestep: number;
    natoms: number;
    fileId?: string;
    simulationCell?: SimulationCell;
    boxBounds?: BoxBounds;
}
