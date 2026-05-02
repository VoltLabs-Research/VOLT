import { AnalysisStatus } from '@/modules/fractal/types';

export { AnalysisStatus };
export { AnalysisStatus as CanvasAnalysisStatusEnum };

export type CanvasAnalysisStatus = AnalysisStatus;

export interface CanvasAnalysisStatusEntry {
    status: CanvasAnalysisStatus;
    trajectoryId?: string;
}

export const isCanvasAnalysisInProgress = (status?: CanvasAnalysisStatus): boolean => {
    return status === AnalysisStatus.Pending || status === AnalysisStatus.Running;
};

export const normalizeCanvasAnalysisStatus = (status?: string | null): CanvasAnalysisStatus | undefined => {
    if (!status) {
        return undefined;
    }

    switch (status.toLowerCase()) {
        case AnalysisStatus.Pending:
            return AnalysisStatus.Pending;
        case AnalysisStatus.Running:
            return AnalysisStatus.Running;
        case AnalysisStatus.Completed:
            return AnalysisStatus.Completed;
        case AnalysisStatus.Failed:
            return AnalysisStatus.Failed;
        default:
            return undefined;
    }
};
