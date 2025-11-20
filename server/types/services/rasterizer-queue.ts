import { BaseJob } from '@/types/queues/base-processing-queue';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';

export interface RasterizerJob extends BaseJob{
    opts: Partial<HeadlessRasterizerOptions>;
    sessionStartTime?: string;
    timestep: number;
    isPreview?: boolean;
}