import { useEffect, useState } from 'react';
import useTrajectoryStore from '@/stores/trajectories';
import Loader from '@/components/atoms/Loader';
import useTrajectoryPreview from '@/hooks/trajectory/use-trajectory-preview';
import { GoArrowUpRight } from "react-icons/go";
import useLogger from '@/hooks/useLogger';
import './TrajectoryPreview.css';

const TrajectoryPreview = () => {
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const [trajectory, setTrajectory] = useState<any>(null);
    const logger = useLogger('trajectory-preview');

    const {
        previewBlobUrl,
        isLoading: previewLoading,
        error: previewError,
        cleanup: cleanupPreview,
        retry: retryPreview
    } = useTrajectoryPreview({
        trajectoryId: trajectory?._id,
        previewId: trajectory?.preview,
        updatedAt: trajectory?.updatedAt,
        enabled: !!trajectory
    });

    useEffect(() => {
        if(!trajectory && trajectories.length > 0){
            logger.log('Setting first trajectory as preview:', trajectories[0]);
            setTrajectory(trajectories[0]);
        }
    }, [trajectories, trajectory]);

    useEffect(() => {
        return () => {
            cleanupPreview();
            setTrajectory(null);
        };
    }, [cleanupPreview]);

    return (
        <div className='trajectory-preview-container'>
            {(previewLoading || trajectories.length === 0) ? (
                <div className='trajectory-preview-loading-container'>
                    <Loader scale={0.6} />
                </div>
            ) : (
                <>
                    <div className='trajectory-preview-item-container trajectory-preview-name-container'>
                        <i className='trajectory-name-icon-container' />
                        <h3 className='trajectory-name'>{trajectory?.name}</h3>
                    </div>

                    <div className='trajectory-preview-item-container trajectory-preview-navigate-container'>
                        <h3 className='trajectory-navigate'>View</h3>
                        <i className='trajectory-navigate-icon-container'>
                            <GoArrowUpRight />
                        </i>
                    </div>
                </>
            )}
            
            <div className='trajectory-preview-scene-container'>
                {(previewBlobUrl && !previewError) && (
                    <img 
                        className='simulation-image' 
                        src={previewBlobUrl}
                        alt={`Preview of ${trajectory?.name || 'Trajectory'}`}
                        key={`${trajectory?._id}-${trajectory?.preview}-${trajectory?.updatedAt}`}
                        onError={() => {
                            retryPreview();
                        }}
                    />
                )}
            </div>      
        </div>
    );
};

export default TrajectoryPreview;