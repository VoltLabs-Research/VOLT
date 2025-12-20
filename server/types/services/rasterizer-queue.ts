import { BaseJob } from '@/types/queues/base-processing-queue';
import { RasterizerOptions } from '@/utilities/export/rasterizer';

export interface RasterizerJob extends BaseJob{
    opts: Partial<RasterizerOptions>;
    sessionStartTime?: string;
    timestep: number;
}
