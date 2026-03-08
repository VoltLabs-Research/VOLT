import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFrameBoxBounds, getTrajectoryFrameByTimestep } from '@/modules/fractal/utilities/frame-box-bounds';
import { useTrajectoryByIdQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import useFirstCompletedTrajectory from '@/modules/dashboard/hooks/use-first-completed-trajectory';

export const useDashboardPreview = () => {
    const navigate = useNavigate();
    const { completedTrajectory, isLoadingTrajectories } = useFirstCompletedTrajectory();

    const trajectoryQuery = useTrajectoryByIdQuery(
        { trajectoryId: completedTrajectory?._id ?? '' },
        { enabled: Boolean(completedTrajectory?._id) }
    );

    const trajectory = trajectoryQuery.data ?? null;
    const isLoadingPreview = trajectoryQuery.isLoading && Boolean(completedTrajectory?._id);

    const currentTimestep = useMemo(() => {
        if (!trajectory) {
            return undefined;
        }

        const timesteps = trajectory.frames.map((frame) => frame.timestep);

        return timesteps.length > 0 ? Math.min(...timesteps) : undefined;
    }, [trajectory]);

    const previewFrame = useMemo(
        () => getTrajectoryFrameByTimestep(trajectory, currentTimestep),
        [trajectory, currentTimestep]
    );

    const previewBoxBounds = useMemo(() => {
        if (!previewFrame) {
            return null;
        }

        return getFrameBoxBounds(previewFrame);
    }, [previewFrame]);

    const atomCount = useMemo(() => previewFrame?.natoms ?? 0, [previewFrame]);
    const hasPreviewData = Boolean(trajectory?._id) && currentTimestep !== undefined;
    const readyTrajectory = hasPreviewData && !isLoadingPreview ? trajectory : null;
    const readyTimestep = readyTrajectory ? currentTimestep : undefined;

    const openCanvas = () => {
        if (trajectory?._id) {
            navigate(`/canvas/${trajectory._id}`);
        }
    };

    return {
        atomCount,
        completedTrajectory,
        hasPreviewData,
        isLoadingPreview,
        isLoadingTrajectories,
        openCanvas,
        previewBoxBounds,
        readyTrajectory,
        readyTimestep
    };
};

export default useDashboardPreview;
