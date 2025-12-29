import React, { memo, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JobsHistory from '@/components/molecules/common/JobsHistory';
import { useTeamJobsStore } from '@/stores/slices/team';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import { useEditorStore } from '@/stores/slices/editor';
import useToast from '@/hooks/ui/use-toast';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';

interface JobsHistoryViewerProps {
    trajectoryId?: string;
    showHeader?: boolean;
    hideAfterComplete?: boolean;
}

const JobsHistoryViewer: React.FC<JobsHistoryViewerProps> = memo(({
    trajectoryId,
    showHeader = true,
    hideAfterComplete = true
}) => {
    const jobs = useTeamJobsStore((state) => state.jobs);
    const isConnected = useTeamJobsStore((state) => state.isConnected);
    const isLoading = useTeamJobsStore((state) => state.isLoading);
    const updateAnalysisConfig = useAnalysisConfigStore((state) => state.updateAnalysisConfig);
    const getTrajectoryById = useTrajectoryStore((state) => state.getTrajectoryById);
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);
    const { showSuccess } = useToast();

    const hadActiveJobsRef = useRef(false);
    const hasShownCompletionToastRef = useRef(false);

    const trackedJobIdsRef = useRef<Set<string>>(new Set());
    const hasAutoSelectedAnalysisRef = useRef(false);

    const relevantJobs = useMemo(() => {
        if (!trajectoryId) return jobs;
        return jobs.filter((job) => job.trajectoryId === trajectoryId);
    }, [jobs, trajectoryId]);

    const hasActiveJobs = useMemo(() => {
        if (!isConnected || isLoading) return false;
        if (relevantJobs.length === 0) return false;
        return relevantJobs.some((job) => job.status !== 'completed' && job.status !== 'failed');
    }, [relevantJobs, isConnected, isLoading]);

    // Check if ALL jobs are completed (not failed)
    const allJobsCompleted = useMemo(() => {
        if (relevantJobs.length === 0) return false;
        return relevantJobs.every((job) => job.status === 'completed');
    }, [relevantJobs]);

    // Track when we have active jobs and reset for new analysis run
    useEffect(() => {
        if (hasActiveJobs) {
            hadActiveJobsRef.current = true;
            hasShownCompletionToastRef.current = false;
            hasAutoSelectedAnalysisRef.current = false;
            trackedJobIdsRef.current = new Set(); // Reset tracked jobs for new run
        }
    }, [hasActiveJobs]);

    // Track active jobs and detect when they complete
    useEffect(() => {
        if (!trajectoryId) {
            console.log('[JobsHistoryViewer] Skipping - no trajectoryId');
            return;
        }
        if (hasAutoSelectedAnalysisRef.current) {
            console.log('[JobsHistoryViewer] Skipping - already auto-selected');
            return;
        }

        console.log('[JobsHistoryViewer] Checking jobs:', relevantJobs.length, 'tracked:', trackedJobIdsRef.current.size);

        // Find jobs with status != 'completed' and track them by jobId
        for (const job of relevantJobs) {
            if (job.status !== 'completed' && job.status !== 'failed' && job.jobId) {
                if (!trackedJobIdsRef.current.has(job.jobId)) {
                    console.log('[JobsHistoryViewer] Tracking new active job:', job.jobId, 'status:', job.status);
                }
                trackedJobIdsRef.current.add(job.jobId);
            }
        }

        // Check if any tracked job has now completed
        for (const job of relevantJobs) {
            const isTracked = job.jobId && trackedJobIdsRef.current.has(job.jobId);

            // Extract analysisId from jobId if not directly available
            // jobId format is: analysisId-index (e.g., "69485a1b69a50983b651f645-0")
            let analysisId = job.analysisId;
            if (!analysisId && job.jobId && job.jobId.includes('-')) {
                const parts = job.jobId.split('-');
                if (parts.length >= 2) {
                    // Remove the last part (index) to get analysisId
                    parts.pop();
                    analysisId = parts.join('-');
                    console.log('[JobsHistoryViewer] Extracted analysisId from jobId:', analysisId);
                }
            }

            console.log('[JobsHistoryViewer] Checking job:', job.jobId,
                'status:', job.status,
                'isTracked:', isTracked,
                'analysisId:', analysisId);

            if (job.status === 'completed' && isTracked && analysisId) {
                // This tracked job just completed - use its analysisId
                hasAutoSelectedAnalysisRef.current = true;
                console.log('[JobsHistoryViewer] First job completed:', job.jobId, 'analysisId:', analysisId);

                // Refresh trajectory and select the analysis
                (async () => {
                    try {
                        // Refresh trajectory to get updated analysis list
                        console.log('[JobsHistoryViewer] Refreshing trajectory:', trajectoryId);
                        await getTrajectoryById(trajectoryId);
                        console.log('[JobsHistoryViewer] Trajectory refreshed');

                        // Get the updated trajectory with new analysis
                        const updatedTrajectory = useTrajectoryStore.getState().trajectory;
                        const analysisList = updatedTrajectory?.analysis || [];

                        console.log('[JobsHistoryViewer] Analysis list:', analysisList.map((a: any) => a._id));

                        // Find and select the analysis
                        const analysis = analysisList.find((a: any) => a._id === analysisId);

                        if (analysis) {
                            console.log('[JobsHistoryViewer] Selecting analysis:', analysis._id);
                            updateAnalysisConfig(analysis);

                            // Set current timestep to the completed job's frame
                            if (job.timestep !== undefined) {
                                console.log('[JobsHistoryViewer] Setting timestep:', job.timestep);
                                setCurrentTimestep(job.timestep);
                            }
                        } else {
                            console.warn('[JobsHistoryViewer] Analysis not found in trajectory:', analysisId);
                        }
                    } catch (error) {
                        console.error('[JobsHistoryViewer] Failed to auto-select analysis:', error);
                    }
                })();

                break; // Only handle first completed tracked job
            }
        }
    }, [relevantJobs, trajectoryId, updateAnalysisConfig, setCurrentTimestep, getTrajectoryById]);

    // Determine if panel should be visible
    // For Canvas (trajectoryId set): show while there are active jobs
    // For Dashboard (no trajectoryId): show while there are active jobs
    // If hideAfterComplete is false, show if there are any jobs (even if completed)
    const shouldShowPanel = useMemo(() => {
        if (!relevantJobs || relevantJobs.length === 0) return false;
        if (!hideAfterComplete) return true;
        return hasActiveJobs;
    }, [hasActiveJobs, hideAfterComplete, relevantJobs]);

    // Show toast when all jobs complete (only in Canvas)
    useEffect(() => {
        if (!trajectoryId) return; // Only in Canvas
        if (!hadActiveJobsRef.current) return; // Must have had active jobs before
        if (hasShownCompletionToastRef.current) return; // Already shown toast
        if (hasActiveJobs) return; // Still have active jobs

        if (allJobsCompleted) {
            // Small delay after panel closes for better UX
            const timer = setTimeout(() => {
                showSuccess('Analysis completed successfully!');
                hasShownCompletionToastRef.current = true;
                hadActiveJobsRef.current = false; // Reset for next analysis
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [hasActiveJobs, allJobsCompleted, trajectoryId, showSuccess]);

    // Apple-style spring animation
    const panelVariants = {
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
                type: 'spring' as const,
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
                ease: [0.4, 0, 0.2, 1] as const
            }
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
                        {showHeader && (
                            <Container
                                className='jobs-history-viewer-header-enhanced f-shrink-0'
                                style={{ touchAction: 'none' }}
                            >
                                <Container className='header-content column gap-02 d-flex flex-1'>
                                    <Title className='font-size-2-5 font-weight-6 color-primary'>
                                        {trajectoryId ? 'Trajectory Jobs' : 'Recent Team Activity'}
                                    </Title>
                                    <Paragraph className='font-size-2 color-secondary jobs-history-subtitle overflow-hidden'>
                                        {trajectoryId
                                            ? 'Analysis and processing jobs for this trajectory.'
                                            : 'The listed processes are queued and executed given the cluster load.'}
                                    </Paragraph>
                                </Container>
                            </Container>
                        )}
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

