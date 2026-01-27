import React, { memo, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import JobsHistory from '@/shared/presentation/components/molecules/common/JobsHistory';
import { useJobStore } from '@/modules/jobs/presentation/stores';
import { useAnalysisStore } from '@/modules/analysis/presentation/stores';
import { useTrajectory, trajectoryQueryKeys } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import { getTrajectoryUseCases } from '@/modules/trajectory/application/registry';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import useToast from '@/shared/presentation/hooks/ui/use-toast';
import Container from '@/shared/presentation/components/primitives/Container';
import type { TrajectoryJobGroup, Job } from '@/modules/jobs/domain/entities';
import { JobGroupService } from '@/modules/jobs/domain/services/JobGroupService';

interface JobsHistoryViewerProps {
    trajectoryId?: string;
    showHeader?: boolean;
    hideAfterComplete?: boolean;
    queueFilter?: string;
}

const jobGroupService = new JobGroupService();

const JobsHistoryViewer: React.FC<JobsHistoryViewerProps> = memo(({
    trajectoryId,
    hideAfterComplete = true,
    queueFilter
}) => {
    const queryClient = useQueryClient();
    const groups = useJobStore((state) => state.groups);
    const isConnected = useJobStore((state) => state.isConnected);
    const isLoading = useJobStore((state) => state.isLoading);
    const updateAnalysisConfig = useAnalysisStore((state) => state.updateAnalysisConfig);
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);
    const { showSuccess } = useToast();
    const { getTrajectoryUseCase } = getTrajectoryUseCases();

    // Use query for general trajectory data if needed, 
    // but the auto-select logic below refetches to be sure.
    const { data: trajectory } = useTrajectory(trajectoryId!, 'analysis', !!trajectoryId);

    const hadActiveJobsRef = useRef(false);
    const hasShownCompletionToastRef = useRef(false);
    const trackedJobIdsRef = useRef<Set<string>>(new Set());
    const hasAutoSelectedAnalysisRef = useRef(false);

    const relevantJobs = useMemo(() => {
        return jobGroupService.filterJobs(groups, trajectoryId, queueFilter);
    }, [groups, trajectoryId, queueFilter]);

    const hasActiveJobs = useMemo(() => {
        if (!isConnected || isLoading) return false;
        if (relevantJobs.length === 0) return false;
        return relevantJobs.some((job: Job) => job.status !== 'completed' && job.status !== 'failed');
    }, [relevantJobs, isConnected, isLoading]);

    const allJobsCompleted = useMemo(() => {
        if (relevantJobs.length === 0) return false;
        return relevantJobs.every((job: Job) => job.status === 'completed');
    }, [relevantJobs]);

    useEffect(() => {
        if (hasActiveJobs) {
            hadActiveJobsRef.current = true;
            hasShownCompletionToastRef.current = false;
            hasAutoSelectedAnalysisRef.current = false;
            trackedJobIdsRef.current = new Set();
        }
    }, [hasActiveJobs]);

    useEffect(() => {
        if (!trajectoryId || hasAutoSelectedAnalysisRef.current) return;

        for (const job of relevantJobs) {
            if (job.status !== 'completed' && job.status !== 'failed' && job.jobId) {
                trackedJobIdsRef.current.add(job.jobId);
            }
        }

        for (const job of relevantJobs) {
            const isTracked = job.jobId && trackedJobIdsRef.current.has(job.jobId);
            let analysisId = job.analysisId;
            if (!analysisId && job.jobId?.includes('-')) {
                const parts = job.jobId.split('-');
                parts.pop();
                analysisId = parts.join('-');
            }

            if (job.status === 'completed' && isTracked && analysisId) {
                hasAutoSelectedAnalysisRef.current = true;
                (async () => {
                    try {
                        // Refetch trajectory to get updated analysis list
                        const updatedTrajectory = await getTrajectoryUseCase.execute(trajectoryId, 'analysis');
                        // Update query cache
                        queryClient.setQueryData(trajectoryQueryKeys.detail(trajectoryId), updatedTrajectory);
                        
                        const analysisList = updatedTrajectory?.analysis || [];
                        const analysis = analysisList.find((a: any) => a._id === analysisId);
                        if (analysis) {
                            updateAnalysisConfig(analysis);
                            if (job.timestep !== undefined) setCurrentTimestep(job.timestep);
                        }
                    } catch (error) {
                        console.error('[JobsHistoryViewer] Failed to auto-select analysis:', error);
                    }
                })();
                break;
            }
        }
    }, [relevantJobs, trajectoryId, updateAnalysisConfig, setCurrentTimestep, queryClient, getTrajectoryUseCase]);

    const shouldShowPanel = useMemo(() => {
        if (relevantJobs.length === 0) return false;
        if (!hideAfterComplete) return true;
        return hasActiveJobs;
    }, [hasActiveJobs, hideAfterComplete, relevantJobs]);

    useEffect(() => {
        if (!trajectoryId) return;
        if (!hadActiveJobsRef.current) return;
        if (hasShownCompletionToastRef.current) return;
        if (hasActiveJobs) return;

        if (allJobsCompleted) {
            const timer = setTimeout(() => {
                showSuccess('Analysis completed successfully!');
                hasShownCompletionToastRef.current = true;
                hadActiveJobsRef.current = false;
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [hasActiveJobs, allJobsCompleted, trajectoryId, showSuccess]);

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
        <AnimatePresence mode="wait">
            {shouldShowPanel && (
                <motion.div
                    key="jobs-panel"
                    variants={panelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className='jobs-history-viewer-enhanced expanded p-absolute overflow-hidden cursor-pointer'
                >
                    <Container className='jobs-history-expanded-content'>
                        <Container className='jobs-history-viewer-body-enhanced y-auto flex-1'>
                            <JobsHistory trajectoryId={trajectoryId} />
                        </Container>
                    </Container>
                </motion.div>
            )}
        </AnimatePresence>
    );
});

JobsHistoryViewer.displayName = 'JobsHistoryViewer';

export default JobsHistoryViewer;
