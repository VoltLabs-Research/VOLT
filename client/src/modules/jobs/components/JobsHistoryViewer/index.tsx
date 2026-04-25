import JobsHistory from '@/modules/jobs/components/JobsHistory';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import useTeamJobs from '@/modules/jobs/hooks/use-team-jobs';
import useJobsHistoryFilters from '@/modules/jobs/hooks/use-jobs-history-filters';
import useJobsAutoSelectAnalysis from '@/modules/jobs/hooks/use-jobs-auto-select-analysis';
import useJobsCompletionToast from '@/modules/jobs/hooks/use-jobs-completion-toast';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import '@/modules/jobs/components/JobsHistoryViewer/JobsHistoryViewer.css';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Variants } from 'framer-motion';

interface JobsHistoryViewerProps {
    trajectoryId?: string;
    hideAfterComplete?: boolean;
    queueFilter?: string;
    variant?: 'floating' | 'embedded';
    displayMode?: 'full' | 'children-only';
    emptyState?: ReactNode;
    autoSelectAnalysis?: boolean;
    groupStatusPresentation?: 'badge' | 'trajectory-name';
};

type DisplayMode = 'full' | 'children-only';
type SpringTransitionType = 'spring';
type ExitEase = [number, number, number, number];

const SPRING_TRANSITION_TYPE: SpringTransitionType = 'spring';
const PANEL_EXIT_EASE: ExitEase = [0.4, 0, 0.2, 1];

const JobsHistoryViewer = (props: JobsHistoryViewerProps) => {
    const {
        trajectoryId,
        hideAfterComplete = true,
        queueFilter,
        variant = 'floating',
        displayMode,
        emptyState,
        autoSelectAnalysis = true,
        groupStatusPresentation = 'badge'
    } = props;
    const prefersReducedMotion = usePrefersReducedMotion();
    const { groups, isConnected, isLoading } = useTeamJobs({ subscribe: false });
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

    const panelVariants: Variants = {
        hidden: {
            opacity: 0,
            scale: 0.95,
            y: 10,
            filter: 'blur(4px)'
        },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            filter: 'blur(0px)',
            transition: {
                type: SPRING_TRANSITION_TYPE,
                stiffness: 300,
                damping: 25,
                mass: 0.8
            }
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: 10,
            filter: 'blur(4px)',
            transition: {
                duration: 0.4,
                ease: PANEL_EXIT_EASE
            }
        }
    };

    let resolvedDisplayMode: DisplayMode = 'full';
    if (displayMode) {
        resolvedDisplayMode = displayMode;
    } else if (variant === 'embedded') {
        resolvedDisplayMode = 'children-only';
    }

    if (variant === 'embedded') {
        return (
            <div className='jobs-history-viewer-embedded'>
                <JobsHistory
                    trajectoryId={trajectoryId}
                    queueFilter={queueFilter}
                    groups={groups}
                    isLoading={isLoading}
                    displayMode={resolvedDisplayMode}
                    groupStatusPresentation={groupStatusPresentation}
                />
            </div>
        );
    }

    if (!shouldShowPanel && emptyState && !isLoading && relevantJobs.length === 0) {
        return <>{emptyState}</>;
    }

    if (prefersReducedMotion) {
        if (!shouldShowPanel) {
            return null;
        }

        return (
            <div className='jobs-history-viewer-enhanced expanded overflow-hidden left-1 bottom-1 radius-2xl p-0'>
                <div className='jobs-history-expanded-content'>
                    <div className='jobs-history-viewer-body-enhanced y-auto flex-1'>
                        <JobsHistory
                            trajectoryId={trajectoryId}
                            queueFilter={queueFilter}
                            groups={groups}
                            isLoading={isLoading}
                            displayMode={resolvedDisplayMode}
                            groupStatusPresentation={groupStatusPresentation}
                        />
                    </div>
                </div>
            </div>
        );
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
                    className='jobs-history-viewer-enhanced expanded overflow-hidden left-1 bottom-1 radius-2xl p-0'
                >
                    <div className='jobs-history-expanded-content'>
                        <div className='jobs-history-viewer-body-enhanced y-auto flex-1'>
                            <JobsHistory
                                trajectoryId={trajectoryId}
                                queueFilter={queueFilter}
                                groups={groups}
                                isLoading={isLoading}
                                displayMode={resolvedDisplayMode}
                                groupStatusPresentation={groupStatusPresentation}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default JobsHistoryViewer;
