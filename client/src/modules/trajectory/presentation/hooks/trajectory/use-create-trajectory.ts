import { useCallback } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from './use-trajectory-services';
import { sileo } from 'sileo';
import { Trajectory } from '@/modules/trajectory/domain/entities';
import { v4 } from 'uuid';
import ApiError from '@/shared/errors/ApiError';

const useCreateTrajectory = () => {
    const { trajectoryRepository } = useTrajectoryUseCases();
    const setUploadProgress = useTrajectoryStore((state) => state.setUploadProgress);
    const setUploadStatus = useTrajectoryStore((state) => state.setUploadStatus);
    const removeUpload = useTrajectoryStore((state) => state.removeUpload);
    const addTrajectory = useTrajectoryStore((state) => state.addTrajectory);
    const setError = useTrajectoryStore((state) => state.setError);

    const createTrajectory = useCallback(async (
        formData: FormData,
        onProgress?: (progress: number) => void
    ): Promise<Trajectory | null> => {
        const uploadId = v4();
        setUploadProgress(uploadId, 0, 'uploading');

        try{
            const result = await trajectoryRepository.create(formData, (progress: number) => {
                setUploadProgress(uploadId, progress, progress >= 1 ? 'waiting_for_jobs' : 'uploading');
                onProgress?.(progress);
            });

            removeUpload(uploadId);
            addTrajectory(result.trajectory);
            return result.trajectory;
        }catch(error){
            setUploadStatus(uploadId, 'failed');
            setTimeout(() => removeUpload(uploadId), 2000);
            if(ApiError.isRBACError(error)){
                const msg = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to create trajectories';
                setError(msg);
                sileo.error({ title: msg });
                return null;
            }
            setError(error instanceof Error ? error.message : 'Failed to create trajectory');
            sileo.error({ title: 'Failed to create trajectory', description: 'Please check your files and try again.' });
            return null;
        }
    }, [trajectoryRepository, setUploadProgress, setUploadStatus, removeUpload, addTrajectory, setError]);

    return createTrajectory;
};

export default useCreateTrajectory;
