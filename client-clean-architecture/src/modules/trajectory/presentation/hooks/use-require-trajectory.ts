import { useTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';

interface UseRequireTrajectoryOptions {
    trajectoryId?: string;
    enabled?: boolean;
}

const useRequireTrajectory = (options: UseRequireTrajectoryOptions) => {
    const { trajectoryId, enabled = true } = options;

    const { data: trajectory, isLoading, error } = useTrajectory(
        trajectoryId!,
        'frames',
        { enabled: enabled && !!trajectoryId }
    );

    return {
        trajectory,
        isLoading,
        error,
        isReady: !!trajectory && trajectory._id === trajectoryId && !isLoading
    };
};

export default useRequireTrajectory;
