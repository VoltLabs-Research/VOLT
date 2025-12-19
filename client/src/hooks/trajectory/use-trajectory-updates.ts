import { useEffect, useRef } from 'react';
import { socketService } from '@/services/socketio';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';
import trajectoryApi from '@/services/api/trajectory';

type PendingUpdate = {
    status: 'queued' | 'processing' | 'rendering' | 'completed' | 'failed';
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

const patchTrajectoryStatus = (state: any, trajectoryId: string, pending: PendingUpdate) => {
    const updateData: any = {
        _id: trajectoryId,
        status: pending.status
    };

    if(pending.updatedAt) updateData.updatedAt = pending.updatedAt;

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

    const fetchAndUpsert = async(trajectoryId: string, pending?: PendingUpdate) => {
        const inFlight = inFlightRef.current;
        if(inFlight.has(trajectoryId)) return;
        inFlight.add(trajectoryId);

        try{
            const fetched = await trajectoryApi.getOne(trajectoryId, 'team,analysis');
            const trajectoryToInsert = pending
                ? {
                    ...fetched,
                    status: pending.status,
                        ...(pending.updatedAt ? { updatedAt: pending.updatedAt } : {})
                }
                : fetched;

            useTrajectoryStore.setState((state) => upsertTrajectory(state, trajectoryToInsert));
        }finally{
            inFlight.delete(trajectoryId);
        }
    };

    useEffect(() => {
        const unsubscribeStatus = socketService.on('trajectory_status_updated', (data: any) => {
            const { trajectoryId, status, updatedAt } = data;
            logger.log('Trajectory status update received', { trajectoryId, status, updatedAt });

            useTrajectoryStore.setState((state) => {
                const existing = state.trajectories.find((t: any) => t._id === trajectoryId);
                if(!existing){
                    fetchAndUpsert(trajectoryId, { status, updatedAt });
                    return state;
                }

                return patchTrajectoryStatus(state, trajectoryId, { status, updatedAt });
            });
        });

        const unsubscribeSession = socketService.on('trajectory_session_completed', (data: any) => {
            const { trajectoryId, completedAt } = data;
            logger.log('Trajectory session completed', { trajectoryId, completedAt });

            useTrajectoryStore.setState((state) => {
                const existing = state.trajectories.find((t: any) => t._id === trajectoryId);
                if(!existing){
                    fetchAndUpsert(trajectoryId, { status: 'completed', updatedAt: completedAt });
                    return state;
                }
                return patchTrajectoryStatus(state, trajectoryId, { status: 'completed', updatedAt: completedAt });
            });
        });

        return () => {
            unsubscribeSession();
            unsubscribeStatus();
        };
    }, [logger]);
};

export default useTrajectoryUpdates;
