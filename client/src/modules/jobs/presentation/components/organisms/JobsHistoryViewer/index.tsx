import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JobsHistory from '@/modules/jobs/presentation/components/organisms/JobsHistory';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import useGetTrajectoryById from '@/modules/trajectory/presentation/hooks/trajectory/use-get-trajectory-by-id';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import useToast from '@/shared/presentation/hooks/use-toast';
import useTeamJobs from '@/modules/jobs/presentation/hooks/use-team-jobs';
import useJobsHistoryFilters from '@/modules/jobs/presentation/hooks/use-jobs-history-filters';
import useJobsAutoSelectAnalysis from '@/modules/jobs/presentation/hooks/use-jobs-auto-select-analysis';
import useJobsCompletionToast from '@/modules/jobs/presentation/hooks/use-jobs-completion-toast';
import '@/modules/jobs/presentation/components/organisms/JobsHistoryViewer/JobsHistoryViewer.css';

interface JobsHistoryViewerProps {
    trajectoryId?: string;
    showHeader?: boolean;
    hideAfterComplete?: boolean;
    queueFilter?: string;
}

const JobsHistoryViewer: React.FC<JobsHistoryViewerProps> = memo((props) => {
    const {
        trajectoryId,
        hideAfterComplete = true,
        queueFilter
    } = props;
    const { groups, isConnected, isLoading, removeTrajectoryGroup } = useTeamJobs();
    const { updateSearchParams } = useSearchParamsState();
    const { refetch: refetchTrajectory } = useGetTrajectoryById({ trajectoryId, enabled: false });
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);
    const { showSuccess } = useToast();
    const {
        relevantJobs,
        hasActiveJobs,
        allJobsCompleted,
        shouldShowPanel
    } = useJobsHistoryFilters({
        groups,
        trajectoryId,
        queueFilter,
        isConnected,
        isLoading,
        hideAfterComplete
    });

    const { resetTracking } = useJobsAutoSelectAnalysis({
        trajectoryId,
        jobs: relevantJobs,
        updateSearchParams,
        setCurrentTimestep,
        refetchTrajectory
    });

    useJobsCompletionToast({
        trajectoryId,
        hasActiveJobs,
        allJobsCompleted,
        showSuccess
    });

    useEffect(() => {
        if (!hasActiveJobs) return;
        resetTracking();
    }, [hasActiveJobs, resetTracking]);

    const panelVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 10, filter: 'blur(4px)' },
        visible: {
            opacity: 1, scale: 1, y: 0, filter: 'blur(0px)',
            transition: { type: 'spring' as const, stiffness: 300, damping: 25, mass: 0.8 }
        },
        exit: {
            opacity: 0, scale: 0.95, y: 10, filter: 'blur(4px)',
            transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }
        }
    };

    return (
        <AnimatePresence mode='wait'>
            {shouldShowPanel && (
                <motion.div
                    key='jobs-panel'
                    variants={panelVariants}
                    initial='hidden'
                    animate='visible'
                    exit='exit'
                    className='jobs-history-viewer-enhanced expanded p-absolute overflow-hidden cursor-pointer left-1 bottom-1 radius-2xl p-0'
                >
                    <div className='jobs-history-expanded-content p-absolute inset-0'>
                        <div className='jobs-history-viewer-body-enhanced y-auto flex-1'>
                            <JobsHistory
                                trajectoryId={trajectoryId}
                                queueFilter={queueFilter}
                                groups={groups}
                                isConnected={isConnected}
                                isLoading={isLoading}
                                onRemoveTrajectoryGroup={removeTrajectoryGroup}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});

JobsHistoryViewer.displayName = 'JobsHistoryViewer';

export default JobsHistoryViewer;
