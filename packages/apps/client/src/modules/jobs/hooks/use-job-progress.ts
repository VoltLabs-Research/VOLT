import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import {
    computeAnalysisRunProgress,
    readJobProgress,
    type AnalysisRunProgress,
    type ReportedJobProgress
} from '@/modules/jobs/utils/job-progress';
import { useMemo } from 'react';

// What the plugin running one frame of an analysis last reported; null while it reported nothing.
export const useFrameJobProgress = (analysisId?: string, timestep?: number): ReportedJobProgress | null => {
    const { data: groups = [] } = teamJobsGroups();

    return useMemo(() => {
        if (!analysisId || timestep === undefined) return null;
        for (const group of groups) {
            for (const frame of group.frameGroups) {
                if (frame.timestep !== timestep) continue;
                const job = frame.jobs.find((candidate) => candidate.analysisId === analysisId);
                if (job) return readJobProgress(job);
            }
        }
        return null;
    }, [groups, analysisId, timestep]);
};

// How far a run is across its frames, while it is still working; null otherwise.
export const useAnalysisRunProgress = (
    analysisId: string,
    totalFrames: number | undefined,
    enabled: boolean
): AnalysisRunProgress | null => {
    const { data: groups = [] } = teamJobsGroups();

    return useMemo(
        () => (enabled ? computeAnalysisRunProgress(groups, analysisId, totalFrames) : null),
        [enabled, groups, analysisId, totalFrames]
    );
};
