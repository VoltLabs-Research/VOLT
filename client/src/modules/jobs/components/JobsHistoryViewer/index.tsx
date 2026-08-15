import JobsHistory from '@/modules/jobs/components/JobsHistory';
import { useEditorStore } from '@/modules/canvas/store/editor';
import useTeamJobs from '@/modules/jobs/hooks/use-team-jobs';
import useJobsHistoryFilters from './use-jobs-history-filters';
import useJobsAutoSelectAnalysis from './use-jobs-auto-select-analysis';
import useJobsCompletionToast from './use-jobs-completion-toast';
import { useEffect } from 'react';

interface JobsHistoryViewerProps {
    trajectoryId?: string;
    queueFilter?: string;
    displayMode?: 'full' | 'children-only';
    autoSelectAnalysis?: boolean;
};

const JobsHistoryViewer = (props: JobsHistoryViewerProps) => {
    const {
        trajectoryId,
        queueFilter,
        displayMode = 'children-only',
        autoSelectAnalysis = true
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
        <div className='flex flex-col w-full h-full'>
            <JobsHistory
                trajectoryId={trajectoryId}
                queueFilter={queueFilter}
                groups={groups}
                isLoading={isLoading}
                displayMode={displayMode}
            />
        </div>
    );
};

export default JobsHistoryViewer;
