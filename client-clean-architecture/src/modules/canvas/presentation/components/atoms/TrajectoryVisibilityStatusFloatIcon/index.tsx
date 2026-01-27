import { useCallback } from 'react';
import { CiLock, CiUnlock } from "react-icons/ci";
import { useParams } from 'react-router';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';
import { useTrajectory, useUpdateTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import Button from '@/shared/presentation/components/primitives/Button';
import '@/modules/canvas/presentation/components/atoms/TrajectoryVisibilityStatusFloatIcon/TrajectoryVisibilityStatusFloatIcon.css';

const TrajectoryVisibilityStatusFloatIcon = () => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { data: trajectory } = useTrajectory(trajectoryId!);
    const updateMutation = useUpdateTrajectory();

    const isPublic = !!trajectory?.isPublic;
    const id = trajectory?._id;

    const onToggle = useCallback(async () => {
        if (updateMutation.isPending || !id) return;
        try {
            await updateMutation.mutateAsync({ id, data: { isPublic: !isPublic } });
        } catch (error: any) {
            console.error('Failed to toggle trajectory visibility:', error);
        }
    }, [updateMutation.isPending, updateMutation.mutateAsync, id, isPublic]);

    if (!trajectory) return null;

    const tooltipContent = isPublic ? 'Public · Click to make Private' : 'Private · Click to make Public';

    return (
        <EditorWidget
            className={`trajectory-share-status-container ${updateMutation.isPending ? 'is-disabled' : ''} p-absolute overflow-hidden p-1`}
        >
            <Tooltip content={tooltipContent} placement="left">
                <Button
                    variant='ghost'
                    intent='neutral'
                    className='share-btn'
                    iconOnly
                    onClick={onToggle}
                    disabled={updateMutation.isPending}
                    aria-label={isPublic ? 'Make trajectory private' : 'Make trajectory public'}
                >
                    {isPublic ? <CiUnlock /> : <CiLock />}
                </Button>
            </Tooltip>
        </EditorWidget>
    );
};

export default TrajectoryVisibilityStatusFloatIcon;
