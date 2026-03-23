import {
    hasFrameBoxBounds,
    getFrameBoxBounds
} from '@/modules/fractal/utilities/frame-box-bounds';
import useFirstCompletedTrajectory from '@/modules/dashboard/hooks/use-first-completed-trajectory';
import { computeGlbUrl } from '@/modules/fractal/api/service/compute-glb-url';
import { DEFAULT_SCENE } from '@/modules/fractal/utilities/scene-utils';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTrajectoryByIdQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokenStorage } from '@/shared/auth/token-storage';
import type { TimestepInfo, Trajectory } from '@/modules/trajectory/api/entities/trajectory';

const getPreviewFrameCandidates = (trajectory: Trajectory | null): TimestepInfo[] => {
    if (!trajectory?.frames?.length) {
        return [];
    }

    return trajectory.frames
        .filter(hasFrameBoxBounds)
        .slice()
        .sort((left, right) => left.timestep - right.timestep);
};

const resolveFirstAvailableGlbTimestep = async (
    teamId: string,
    trajectoryId: string,
    candidates: TimestepInfo[],
    signal: AbortSignal
): Promise<number | null> => {
    for (const frame of candidates) {
        if (signal.aborted) {
            return null;
        }

        const url = computeGlbUrl({
            teamId,
            trajectoryId,
            currentTimestep: frame.timestep,
            analysisId: 'default',
            activeScene: DEFAULT_SCENE
        });

        if (!url) {
            continue;
        }

        try {
            const token = tokenStorage.getToken();
            const response = await fetch(url, {
                method: 'HEAD',
                signal,
                credentials: 'same-origin',
                headers: token ? {
                    Authorization: `Bearer ${token}`
                } : undefined
            });

            if (!response.ok) {
                continue;
            }

            return frame.timestep;
        } catch {
            continue;
        }
    }

    return null;
};

export const useDashboardPreview = () => {
    const teamId = useSelectedTeamId();
    const navigate = useNavigate();
    const { completedTrajectory, isLoadingTrajectories } = useFirstCompletedTrajectory();
    const [readyTimestep, setReadyTimestep] = useState<number | undefined>(undefined);
    const [isResolvingPreviewModel, setIsResolvingPreviewModel] = useState(false);

    const trajectoryQuery = useTrajectoryByIdQuery(
        { trajectoryId: completedTrajectory?._id ?? '' },
        { enabled: Boolean(completedTrajectory?._id) }
    );

    const trajectory = trajectoryQuery.data ?? null;
    const previewFrameCandidates = useMemo(() => getPreviewFrameCandidates(trajectory), [trajectory]);
    const previewCandidateTimestepsKey = useMemo(() => {
        return previewFrameCandidates.map((frame) => frame.timestep).join(':');
    }, [previewFrameCandidates]);
    const trajectoryId = trajectory?._id;

    useEffect(() => {
        setReadyTimestep(undefined);

        if (!trajectoryId || !teamId || !previewFrameCandidates.length) {
            setIsResolvingPreviewModel(false);
            return;
        }

        const abortController = new AbortController();
        setIsResolvingPreviewModel(true);

        void resolveFirstAvailableGlbTimestep(
            teamId,
            trajectoryId,
            previewFrameCandidates,
            abortController.signal
        ).then((timestep) => {
            if (abortController.signal.aborted) {
                return;
            }

            setReadyTimestep(timestep ?? undefined);
        }).finally(() => {
            if (abortController.signal.aborted) {
                return;
            }

            setIsResolvingPreviewModel(false);
        });

        return () => {
            abortController.abort();
        };
    }, [teamId, trajectoryId, previewCandidateTimestepsKey, previewFrameCandidates]);

    const isLoadingPreview = Boolean(completedTrajectory?._id)
        && (trajectoryQuery.isLoading || isResolvingPreviewModel || !teamId);

    const previewFrame = useMemo(() => {
        if (readyTimestep === undefined) {
            return undefined;
        }

        return previewFrameCandidates.find((frame) => frame.timestep === readyTimestep);
    }, [previewFrameCandidates, readyTimestep]);

    const previewBoxBounds = useMemo(() => {
        if (!previewFrame) {
            return null;
        }

        return getFrameBoxBounds(previewFrame);
    }, [previewFrame]);

    const atomCount = useMemo(() => previewFrame?.natoms ?? 0, [previewFrame]);
    const hasPreviewData = Boolean(trajectory?._id) && Boolean(previewFrame) && Boolean(previewBoxBounds) && readyTimestep !== undefined;
    let readyTrajectory: Trajectory | null = null;
    if (hasPreviewData && !isLoadingPreview) {
        readyTrajectory = trajectory;
    }

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
