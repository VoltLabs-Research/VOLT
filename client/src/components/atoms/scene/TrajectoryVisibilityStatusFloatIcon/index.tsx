import { useCallback, useState } from 'react';
import { CiLock, CiUnlock } from "react-icons/ci";
import EditorWidget from '@/components/organisms/EditorWidget';
import useTrajectoryStore from '@/stores/trajectories';
import './TrajectoryVisibilityStatusFloatIcon.css';

const TrajectoryVisibilityStatusFloatIcon = () => {
    const trajectory = useTrajectoryStore((s) => s.trajectory);
    const updateTrajectoryById = useTrajectoryStore((s) => s.updateTrajectoryById);
    const [isUpdating, setIsUpdating] = useState(false);

    const isPublic = !!trajectory?.isPublic;
    const id = trajectory?._id;

    const onToggle = useCallback(async () => {
        if(isUpdating || !id) return;
        setIsUpdating(true);
        try{
            await updateTrajectoryById(id, { isPublic: !isPublic });
        } catch (error: any) {
            const errorContext = {
                endpoint: `/trajectories/${id}`,
                method: 'PATCH',
                trajectoryId: id,
                operation: 'toggleVisibility',
                statusCode: error?.context?.statusCode,
                serverMessage: error?.context?.serverMessage || error?.message,
                timestamp: new Date().toISOString()
            };
            console.error('Failed to toggle trajectory visibility:', errorContext);
        } finally {
            setIsUpdating(false);
        }
    }, [isUpdating, updateTrajectoryById, id, isPublic]);

    if(!trajectory) return null;

    return (
        <EditorWidget 
            className={`trajectory-share-status-container ${isUpdating ? 'is-disabled' : ''}`}
        >
            <button 
                className='trajectory-share-status-icon-container'
                onClick={onToggle}
                title={isPublic ? 'Public · Click to make Private' : 'Private · Click to make Public'}
                disabled={isUpdating}
                aria-label={isPublic ? 'Make trajectory private' : 'Make trajectory public'}
            >
                {isPublic ? <CiUnlock /> : <CiLock />}
            </button>
        </EditorWidget>
    );
};

export default TrajectoryVisibilityStatusFloatIcon;