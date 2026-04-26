import { useCallback } from 'react';
import { sileo } from 'sileo';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { useCloneTrajectoryMutation } from './queries';
import {
    useTrajectoryCloneFlowStore,
    type PendingExecutionIntent
} from '../stores/use-trajectory-clone-flow-store';
import type { Job } from '@/modules/jobs/api/entities/job';
import { useNavigate } from 'react-router-dom';
const CLONE_QUEUE_TYPE = 'trajectory_clone';

interface CloneAndRunArgs {
    sourceTrajectoryId: string;
    targetClusterId: string;
    intent: PendingExecutionIntent;
};

const formatProgressMessage = (copied: number, total: number): string => {
    if (total > 0) {
        return `${copied} / ${total} frames copied`;
    }
    return `${copied} frames copied`;
};

const useTrajectoryCloneFlow = () => {
    const navigate = useNavigate();
    const cloneMutation = useCloneTrajectoryMutation();

    const addEntry = useTrajectoryCloneFlowStore((state) => state.addEntry);
    const updateEntry = useTrajectoryCloneFlowStore((state) => state.updateEntry);
    const setToastId = useTrajectoryCloneFlowStore((state) => state.setToastId);
    const removeEntry = useTrajectoryCloneFlowStore((state) => state.removeEntry);

    const handleJobUpdate = useCallback((event: Job) => {
        if (event.queueType !== CLONE_QUEUE_TYPE) {
            return;
        }

        const destinationTrajectoryId = event.trajectoryId;
        if (!destinationTrajectoryId) {
            return;
        }

        const store = useTrajectoryCloneFlowStore.getState();
        const entry = store.entries[destinationTrajectoryId];
        if (!entry || entry.jobId !== event.jobId) {
            return;
        }

        const totalFrames = typeof event.totalFrames === 'number' ? event.totalFrames : entry.totalFrames;
        const copiedFrames = typeof event.copiedFrames === 'number' ? event.copiedFrames : entry.copiedFrames;
        const nextState = (typeof event.cloneState === 'string'
            ? event.cloneState as CloneState
            : entry.state);

        updateEntry(destinationTrajectoryId, {
            totalFrames,
            copiedFrames,
            state: nextState
        });

        if (nextState === 'completed') {
            if (entry.toastId) {
                setToastId(destinationTrajectoryId, undefined);
            }
            sileo.success({
                title: 'Trajectory cloned',
                description: formatProgressMessage(copiedFrames || totalFrames, totalFrames)
            });
            navigate(`/canvas/${destinationTrajectoryId}`);
            return;
        }

        if (nextState === 'failed') {
            if (entry.toastId) {
                setToastId(destinationTrajectoryId, undefined);
            }
            const errorMessage = typeof event.error === 'string' && event.error.length > 0
                ? event.error
                : 'Trajectory clone failed';
            sileo.error({
                title: 'Clone failed',
                description: errorMessage
            });
            removeEntry(destinationTrajectoryId);
            return;
        }

        const nextDescription = formatProgressMessage(copiedFrames, totalFrames);

        const nextToastId = sileo.show({
            type: 'loading',
            title: 'Cloning trajectory',
            description: nextDescription,
            duration: null
        });
        setToastId(destinationTrajectoryId, nextToastId);
    }, [navigate, removeEntry, setToastId, updateEntry]);

    useSocketEvent<Job>(SOCKET_TEAM_EVENTS.JOB_UPDATED, handleJobUpdate);

    const cloneAndRun = useCallback(async ({
        sourceTrajectoryId,
        targetClusterId,
        intent
    }: CloneAndRunArgs): Promise<void> => {
        const toastId = sileo.show({
            type: 'loading',
            title: 'Cloning trajectory',
            description: 'Starting clone…',
            duration: null
        });

        try {
            const result = await cloneMutation.mutateAsync({
                sourceTrajectoryId,
                targetClusterId
            });

            addEntry({
                jobId: result.jobId,
                sourceTrajectoryId: result.sourceTrajectoryId,
                destinationTrajectoryId: result.trajectoryId,
                pendingIntent: intent,
                toastId,
                totalFrames: 0,
                copiedFrames: 0,
                state: 'queued'
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unable to start clone';
            sileo.error({
                title: 'Clone failed',
                description: errorMessage
            });
            throw error;
        }
    }, [addEntry, cloneMutation]);

    return { cloneAndRun };
};

type CloneState = 'queued' | 'preparing' | 'copying' | 'completed' | 'failed';

export default useTrajectoryCloneFlow;
