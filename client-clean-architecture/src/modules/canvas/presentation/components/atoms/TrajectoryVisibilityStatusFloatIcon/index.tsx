import { useCallback, useState } from 'react';
import { CiLock, CiUnlock } from 'react-icons/ci';
import WidgetContainer from '@/modules/canvas/presentation/components/atoms/WidgetContainer';
import Tooltip from '@/shared/presentation/components/Tooltip';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import useUpdateTrajectory from '@/modules/trajectory/presentation/hooks/trajectory/use-update-trajectory';
import Button from '@/shared/presentation/components/Button';
import '@/modules/canvas/presentation/components/atoms/TrajectoryVisibilityStatusFloatIcon/TrajectoryVisibilityStatusFloatIcon.css';

const TrajectoryVisibilityStatusFloatIcon = () => {
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    const updateTrajectory = useUpdateTrajectory();
    const [isUpdating, setIsUpdating] = useState(false);

    const isPublic = !!trajectory?.isPublic;
    const id = trajectory?._id;

    const onToggle = useCallback(async () => {
        if (isUpdating || !id) return;
        setIsUpdating(true);
        try {
            await updateTrajectory(id, { isPublic: !isPublic });
        } catch (error: any) {
            console.error('Failed to toggle trajectory visibility:', error);
        } finally {
            setIsUpdating(false);
        }
    }, [isUpdating, updateTrajectory, id, isPublic]);

    if (!trajectory) return null;

    const tooltipContent = isPublic ? 'Public · Click to make Private' : 'Private · Click to make Public';

    return (
        <WidgetContainer
            className={`trajectory-share-status-container ${isUpdating ? 'is-disabled' : ''} overflow-hidden p-1 right-1 radius-full`}
        >
            <Tooltip content={tooltipContent} placement="left">
                <Button
                    variant='ghost'
                    intent='neutral'
                    className='share-btn'
                    iconOnly
                    onClick={onToggle}
                    disabled={isUpdating}
                    aria-label={isPublic ? 'Make trajectory private' : 'Make trajectory public'}
                >
                    {isPublic ? <CiUnlock /> : <CiLock />}
                </Button>
            </Tooltip>
        </WidgetContainer>
    );
};

export default TrajectoryVisibilityStatusFloatIcon;
