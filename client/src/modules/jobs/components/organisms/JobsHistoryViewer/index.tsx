import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JobsHistory from '@/modules/jobs/components/organisms/JobsHistory';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import useTeamJobs from '@/modules/jobs/hooks/use-team-jobs';
import useJobsHistoryFilters from '@/modules/jobs/hooks/use-jobs-history-filters';
import useJobsAutoSelectAnalysis from '@/modules/jobs/hooks/use-jobs-auto-select-analysis';
import useJobsCompletionToast from '@/modules/jobs/hooks/use-jobs-completion-toast';
import '@/modules/jobs/components/organisms/JobsHistoryViewer/JobsHistoryViewer.css';

interface JobsHistoryViewerProps {
    trajectoryId?: string;
    showHeader?: boolean;
    hideAfterComplete?: boolean;
    queueFilter?: string;
    variant?: 'floating' | 'embedded';
    displayMode?: 'full' | 'children-only';
    emptyState?: React.ReactNode;
}

const JobsHistoryViewer: React.FC<JobsHistoryViewerProps> = (props) => {
    const {
        trajectoryId,
        hideAfterComplete = true,
        queueFilter,
        variant = 'floating',
        displayMode,
        emptyState
    } = props;
    const { groups, isConnected, isLoading } = useTeamJobs();
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);
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
        setCurrentTimestep
    });

    useJobsCompletionToast({
        trajectoryId,
        hasActiveJobs,
        allJobsCompleted
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

    const resolvedDisplayMode = displayMode ?? (variant === 'embedded' ? 'children-only' : 'full');

    if (variant === 'embedded') {
        return (
            <div className='jobs-history-viewer-embedded'>
                <JobsHistory
                    trajectoryId={trajectoryId}
                    queueFilter={queueFilter}
                    groups={groups}
                    isConnected={isConnected}
                    isLoading={isLoading}
                    displayMode={resolvedDisplayMode}
                />
            </div>
        );
    }

    if (!shouldShowPanel && emptyState && !isLoading && relevantJobs.length === 0) {
        return <>{emptyState}</>;
    }

    return (
        <AnimatePresence mode='wait'>
            {shouldShowPanel && (
                <motion.div
                    key='jobs-panel'
                    variants={panelVariants}
                    initial='hidden'
                    animate='visible'
                    exit='exit'
                    className='jobs-history-viewer-enhanced expanded overflow-hidden cursor-pointer left-1 bottom-1 radius-2xl p-0'
                >
                    <div className='jobs-history-expanded-content'>
                        <div className='jobs-history-viewer-body-enhanced y-auto flex-1'>
                            <JobsHistory
                                trajectoryId={trajectoryId}
                                queueFilter={queueFilter}
                                groups={groups}
                                isConnected={isConnected}
                                isLoading={isLoading}
                                displayMode={resolvedDisplayMode}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export { JobsHistoryViewer };
export default JobsHistoryViewer;
