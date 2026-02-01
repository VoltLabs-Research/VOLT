import { useCallback } from 'react';
import useTrajectoryStore from '../../stores/use-trajectory-store';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import { Trajectory } from '@/modules/trajectory/domain/entities';

const useCreateTrajectory = () => {
    const { trajectoryRepository } = useTrajectoryUseCases();
    const setUploadProgress = useTrajectoryStore((state) => state.setUploadProgress);
    const removeUpload = useTrajectoryStore((state) => state.removeUpload);
    const addTrajectory = useTrajectoryStore((state) => state.addTrajectory);
    const setError = useTrajectoryStore((state) => state.setError);

    const createTrajectory = useCallback(async (
        formData: FormData,
        onProgress?: (progress: number) => void
    ): Promise<Trajectory | null> => {
        const uploadId = crypto.randomUUID();
        setUploadProgress(uploadId, 0);

        try{
            const result = await trajectoryRepository.create(formData, (progress: number) => {
                setUploadProgress(uploadId, progress);
                onProgress?.(progress);
            });

            removeUpload(uploadId);
            addTrajectory(result.trajectory);
            return result.trajectory;
        }catch(error){
            removeUpload(uploadId);
            setError(error instanceof Error ? error.message : 'Failed to create trajectory');
            return null;
        }
    }, [trajectoryRepository, setUploadProgress, removeUpload, addTrajectory, setError]);

    return createTrajectory;
};

export default useCreateTrajectory;
