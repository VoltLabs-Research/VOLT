import { useCallback, useState } from 'react';
import { CiLock, CiUnlock } from "react-icons/ci";
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import Tooltip from '@/components/atoms/common/Tooltip';
import { useTrajectoryStore } from '@/features/trajectory/stores';
import Button from '@/components/primitives/Button';
import './TrajectoryVisibilityStatusFloatIcon.css';

const TrajectoryVisibilityStatusFloatIcon = () => {
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    const updateTrajectoryById = useTrajectoryStore((s) => s.updateTrajectoryById);
    const [isUpdating, setIsUpdating] = useState(false);

    const isPublic = !!trajectory?.isPublic;
    const id = trajectory?._id;

    const onToggle = useCallback(async () => {
        if (isUpdating || !id) return;
        setIsUpdating(true);
        try {
            await updateTrajectoryById(id, { isPublic: !isPublic });
        } catch (error: any) {
            console.error('Failed to toggle trajectory visibility:', error);
        } finally {
            setIsUpdating(false);
        }
    }, [isUpdating, updateTrajectoryById, id, isPublic]);

    if (!trajectory) return null;

    const tooltipContent = isPublic ? 'Public · Click to make Private' : 'Private · Click to make Public';

    return (
        <EditorWidget
            className={`trajectory-share-status-container ${isUpdating ? 'is-disabled' : ''} p-absolute overflow-hidden p-1`}
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
        </EditorWidget>
    );
};

export default TrajectoryVisibilityStatusFloatIcon;

