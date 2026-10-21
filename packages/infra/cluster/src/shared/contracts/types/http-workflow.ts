import type { TrajectoryFrame } from '@volt/contracts/modules/analysis/daemon';

export interface TrajectoryDumpDescriptor extends TrajectoryFrame {
    path: string;
    originalPath?: string;
}
