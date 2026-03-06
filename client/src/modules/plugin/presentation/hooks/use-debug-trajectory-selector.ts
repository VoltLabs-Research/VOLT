import { useState, useEffect, useMemo } from 'react';
import { container } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@/modules/trajectory/infrastructure/di/tokens';
import type ITrajectoryRepository from '@/modules/trajectory/domain/port/ITrajectoryRepository';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import { usePluginDebugStore } from '../stores/use-plugin-debug-store';
import ApiError from '@/shared/errors/ApiError';

const useDebugTrajectorySelector = () => {
    const [trajectories, setTrajectories] = useState<Trajectory[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [accessDeniedMessage, setAccessDeniedMessage] = useState<string>();

    const { selectedTrajectoryId, selectedTimestep, setSelectedTrajectory, setSelectedTimestep } = usePluginDebugStore();

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const repo = container.resolve<ITrajectoryRepository>(TRAJECTORY_TOKENS.TrajectoryRepository);
                const result = await repo.getAll();
                if (!cancelled) {
                    // Only show completed trajectories with frames
                    const completed = result.data.filter(
                        (t: Trajectory) => t.status === 'completed' && t.frames && t.frames.length > 0
                    );
                    setTrajectories(completed);
                }
            } catch (err: any) {
                if (!cancelled) {
                    if(ApiError.isRBACError(err)){
                        setAccessDenied(true);
                        if(err instanceof ApiError) setAccessDeniedMessage(err.getFriendlyMessage());
                    }else{
                        setError(err.message || 'Failed to load trajectories');
                    }
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        load();

        return () => { cancelled = true; };
    }, []);

    const selectedTrajectory = useMemo(() => {
        return trajectories.find((t) => t._id === selectedTrajectoryId) || null;
    }, [trajectories, selectedTrajectoryId]);

    const frames = useMemo(() => {
        return selectedTrajectory?.frames || [];
    }, [selectedTrajectory]);

    return {
        trajectories,
        frames,
        selectedTrajectory,
        selectedTrajectoryId,
        selectedTimestep,
        setSelectedTrajectory,
        setSelectedTimestep,
        isLoading,
        error,
        accessDenied,
        accessDeniedMessage
    };
};

export default useDebugTrajectorySelector;
