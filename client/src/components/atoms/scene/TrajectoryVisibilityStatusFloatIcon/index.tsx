import { useCallback, useState } from 'react';
import { CiLock, CiUnlock } from "react-icons/ci";
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import { useTrajectoryStore } from '@/stores/slices/trajectory';
import Button from '@/components/primitives/Button';
import './TrajectoryVisibilityStatusFloatIcon.css';

const TrajectoryVisibilityStatusFloatIcon = () => {
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    const updateTrajectoryById = useTrajectoryStore((s) => s.updateTrajectoryById);
    const [isUpdating, setIsUpdating] = useState(false);

    const isPublic = !!trajectory?.isPublic;
    const id = trajectory?._id;

    const onToggle = useCallback(async() => {
        if(isUpdating || !id) return;
        setIsUpdating(true);
        try{
            await updateTrajectoryById(id, { isPublic: !isPublic });
        }catch(error: any){
            console.error('Failed to toggle trajectory visibility:', errorContext);
        }finally{
            setIsUpdating(false);
        }
    }, [isUpdating, updateTrajectoryById, id, isPublic]);

    if(!trajectory) return null;

    return (
        <EditorWidget
            className={`trajectory-share-status-container ${isUpdating ? 'is-disabled' : ''} p-absolute overflow-hidden`}
        >
            <Button
                variant='ghost'
                intent='neutral'
                className='share-btn'
                iconOnly
                onClick={onToggle}
                title={isPublic ? 'Public · Click to make Private' : 'Private · Click to make Public'}
                disabled={isUpdating}
                aria-label={isPublic ? 'Make trajectory private' : 'Make trajectory public'}
            >
                {isPublic ? <CiUnlock /> : <CiLock />}
            </Button>
        </EditorWidget>
    );
};

export default TrajectoryVisibilityStatusFloatIcon;
