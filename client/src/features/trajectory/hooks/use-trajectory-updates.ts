import { useEffect, useRef } from 'react';
import { socketService } from '@/services/websockets/socketio';
import { useTrajectoryStore } from '@/features/trajectory/stores';
import useLogger from '@/hooks/core/use-logger';
import trajectoryApi from '@/features/trajectory/api/trajectory';

type PendingUpdate = {
    [key: string]: any;
    updatedAt?: string;
};

const upsertTrajectory = (state: any, trajectory: any) => {
    const id = trajectory._id;

    const nextTrajectories = [
        { ...(state.trajectories.find((t: any) => t._id === id) || {}), ...trajectory },
        ...state.trajectories.filter((t: any) => t._id !== id)
    ];

    const nextCurrent = state.trajectory?._id === id
        ? { ...state.trajectory, ...trajectory }
        : state.trajectory;

    return {
        trajectories: nextTrajectories,
        trajectory: nextCurrent
    };
};

const patchTrajectory = (state: any, trajectoryId: string, updates: any) => {
    const updateData: any = {
        _id: trajectoryId,
        ...updates
    };

    const nextTrajectories = [
        { ...(state.trajectories.find((t: any) => t._id === trajectoryId) || {}), ...updateData },
        ...state.trajectories.filter((t: any) => t._id !== trajectoryId)
    ];

    const nextCurrent = state.trajectory?._id === trajectoryId
        ? { ...state.trajectory, ...updateData }
        : state.trajectory;

    return {
        trajectories: nextTrajectories,
        trajectory: nextCurrent
    };
};


const useTrajectoryUpdates = () => {
    const logger = useLogger('use-trajectory-updates');
    const inFlightRef = useRef(new Set<string>());

    const fetchAndUpsert = async (trajectoryId: string, pending?: PendingUpdate) => {
        const inFlight = inFlightRef.current;
        if (inFlight.has(trajectoryId)) return;
        inFlight.add(trajectoryId);

        try {
            const fetched = await trajectoryApi.getOne(trajectoryId);
            const trajectoryToInsert = pending
                ? {
                    ...fetched,
                    status: pending.status,
                    ...(pending.updatedAt ? { updatedAt: pending.updatedAt } : {})
                }
                : fetched;

            useTrajectoryStore.setState((state) => upsertTrajectory(state, trajectoryToInsert));
        } finally {
            inFlight.delete(trajectoryId);
        }
    };

    useEffect(() => {
        const unsubscribeUpdated = socketService.on('trajectory.updated', (data: any) => {
            const { trajectoryId, updates, updatedAt } = data;
            const fullUpdates = { ...updates, updatedAt };

            useTrajectoryStore.setState((state) => {
                const existing = state.trajectories.find((t: any) => t._id === trajectoryId);

                if (!existing) {
                    // If we don't have it, best to fetch the whole thing to be safe
                    fetchAndUpsert(trajectoryId, fullUpdates);
                    return state;
                }

                // When status changes to 'completed', fetch the full trajectory to get all frames/data
                if (updates.status === 'completed' && existing.status !== 'completed') {
                    logger.log('Trajectory completed, fetching full data', { trajectoryId });
                    fetchAndUpsert(trajectoryId, fullUpdates);
                    return state;
                }

                logger.log('Trajectory update received', { trajectoryId, updates });
                return patchTrajectory(state, trajectoryId, fullUpdates);
            });
        });

        return () => {
            unsubscribeUpdated();
        };
    }, [logger]);
};

export default useTrajectoryUpdates;