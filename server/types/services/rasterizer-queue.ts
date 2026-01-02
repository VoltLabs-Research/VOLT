import { BaseJob } from '@/types/queues/base-processing-queue';
import { RasterizerOptions } from '@/utilities/export/rasterizer';

export interface RasterizerJob extends BaseJob{
    opts: Partial<RasterizerOptions>;
    sessionStartTime?: string;
    timestep: number;
    /** Analysis ID if this is an analysis GLB, undefined for base trajectory preview */
    analysisId?: string;
    /** Model name (e.g., 'dislocations', 'grains'), undefined for base trajectory preview */
    model?: string;
}
