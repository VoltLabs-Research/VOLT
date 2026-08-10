import JobsHistory from '@/modules/jobs/components/JobsHistory';
import { useEditorStore } from '@/modules/canvas/store/editor';
import useTeamJobs from '@/modules/jobs/hooks/use-team-jobs';
import useJobsHistoryFilters from '@/modules/jobs/hooks/use-jobs-history-filters';
import useJobsAutoSelectAnalysis from '@/modules/jobs/hooks/use-jobs-auto-select-analysis';
import useJobsCompletionToast from '@/modules/jobs/hooks/use-jobs-completion-toast';
import { useEffect } from 'react';

interface JobsHistoryViewerProps {
    trajectoryId?: string;
    queueFilter?: string;
    displayMode?: 'full' | 'children-only';
    autoSelectAnalysis?: boolean;
    groupStatusPresentation?: 'badge' | 'trajectory-name';
};

const JobsHistoryViewer = (props: JobsHistoryViewerProps) => {
    const {
        trajectoryId,
        queueFilter,
        displayMode = 'children-only',
        autoSelectAnalysis = true,
        groupStatusPresentation = 'badge'
    } = props;
    const { groups, isConnected, isLoading } = useTeamJobs({ subscribe: false });
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);
    const {
        relevantJobs,
        hasActiveJobs,
        allJobsCompleted
    } = useJobsHistoryFilters({
        groups,
        trajectoryId,
        queueFilter,
        isConnected,
        isLoading
    });

    const { resetTracking } = useJobsAutoSelectAnalysis({
        enabled: autoSelectAnalysis,
        trajectoryId,
        jobs: relevantJobs,
        setCurrentTimestep
    });

    useJobsCompletionToast({
        trajectoryId,
        jobs: relevantJobs,
        hasActiveJobs,
        allJobsCompleted
    });

    useEffect(() => {
        if (!autoSelectAnalysis || !hasActiveJobs) return;
        resetTracking();
    }, [autoSelectAnalysis, hasActiveJobs, resetTracking]);

    return (
        <div className='flex flex-col p-3 overflow-y-auto w-full h-full'>
            <JobsHistory
                trajectoryId={trajectoryId}
                queueFilter={queueFilter}
                groups={groups}
                isLoading={isLoading}
                displayMode={displayMode}
                groupStatusPresentation={groupStatusPresentation}
            />
        </div>
    );
};

export default JobsHistoryViewer;
