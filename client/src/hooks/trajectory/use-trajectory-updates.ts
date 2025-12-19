import { useEffect } from 'react';
import { socketService } from '@/services/socketio';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';
import trajectoryApi from '@/services/api/trajectory';

type PendingUpdate = {
    status: 'queued' | 'processing' | 'rendering' | 'completed' | 'failed';
    updatedAt?: string;
};

const upsertTrajectory = (state: any, trajectory: any) => {
    const exists = state.trajectories.some(({ _id }: any) => _id === trajectory._id);

    const nextTrajectories = exists
        ? state.trajectories.map((t: any) => (trajectory._id === t._id ? { ...trajectory, ...t } : t))
        : [trajectory, ...state.trajectories];

    // If the card exists in the dashboard and an update is received, then update it.
    const dashboardExists = state.dashboardTrajectories?.some((t: any) => t._id === trajectory._id);
    const nextDashboard = dashboardExists
        ? state.dashboardTrajectories.map((t: any) => (t._id === trajectory._id ? { ...t, ...trajectory } : t))
        : state.dashboardTrajectories;

    const nextCurrent = state.trajectory?._id === trajectory._id
        ? { ...state.trajectory, ...trajectory }
        : state.trajectory;

    return {
        trajectories: nextTrajectories,
        dashboardTrajectories: nextDashboard,
        trajectory: nextCurrent
    };
};

const patchTrajectoryStatus = (state: any, trajectoryId: string, pending: PendingUpdate) => {
    const updateData: any = {
        status: pending.status
    };

    if(pending.updatedAt) updateData.updatedAt = pending.updatedAt;

    const nextTrajectories = state.trajectories.map((t: any) =>
        t._id === trajectoryId ? { ...t, ...updateData } : t);
    const nextDashboard = state.dashboardTrajectories?.map((t: any) =>
        t._id === trajectoryId ? { ...t, ...updateData } : t);
    const nextCurrent = state.trajectory?._id === trajectoryId ?
        { ...state.trajectory, ...updateData } : state.trajectory;

    return {
        trajectories: nextTrajectories,
        dashboardTrajectories: nextDashboard,
        trajectory: nextCurrent
    };
};

const useTrajectoryUpdates = () => {
    const logger = useLogger('use-trajectory-updates');

    const fetchAndUpsert = async(trajectoryId: string, pending?: PendingUpdate) => {
        const fetched = await trajectoryApi.getOne(trajectoryId, 'team,analysis');
        const trajectoryToInsert = pending
            ? {
                ...fetched,
                status: pending.status,
                    ...(pending.updatedAt ? { updatedAt: pending.updatedAt } : {})
            }
            : fetched;

        useTrajectoryStore.setState((state) => upsertTrajectory(state, trajectoryToInsert));
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
