import { useCallback, useEffect, useRef } from 'react';
import useTrajectoryStore from '../stores/use-trajectory-store';
import { trajectoryQuery } from './trajectory/queries';
import { sileo } from 'sileo';
import type { Trajectory } from '../api/entities/trajectory';
import { v4 } from 'uuid';
import ApiError from '@/shared/errors/ApiError';

const useCreateTrajectory = () => {
    const setUploadProgress = useTrajectoryStore((state) => state.setUploadProgress);
    const setUploadStatus = useTrajectoryStore((state) => state.setUploadStatus);
    const removeUpload = useTrajectoryStore((state) => state.removeUpload);
    const removeUploadTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const mutation = trajectoryQuery.useCreateMutation();

    useEffect(() => {
        return () => {
            for (const timer of removeUploadTimersRef.current.values()) {
                clearTimeout(timer);
            }
            removeUploadTimersRef.current.clear();
        };
    }, []);

    const createTrajectory = useCallback(async (
        formData: FormData,
        onProgress?: (progress: number) => void
    ): Promise<Trajectory | null> => {
        const uploadId = v4();
        setUploadProgress(uploadId, 0, 'uploading');

        try {
            const result = await mutation.mutateAsync({
                formData,
                onProgress: (progress: number) => {
                    setUploadProgress(uploadId, progress, progress >= 1 ? 'waiting_for_jobs' : 'uploading');
                    onProgress?.(progress);
                }
            });

            const existingTimer = removeUploadTimersRef.current.get(uploadId);

            if (existingTimer) {
                clearTimeout(existingTimer);
                removeUploadTimersRef.current.delete(uploadId);
            }

            removeUpload(uploadId);
            return result.trajectory;
        } catch (error) {
            setUploadStatus(uploadId, 'failed');
            const existingTimer = removeUploadTimersRef.current.get(uploadId);

            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                removeUpload(uploadId);
                removeUploadTimersRef.current.delete(uploadId);
            }, 2000);

            removeUploadTimersRef.current.set(uploadId, timer);

            if (ApiError.isRBACError(error)) {
                const message = error instanceof ApiError
                    ? error.getFriendlyMessage()
                    : 'You do not have permission to create trajectories';
                sileo.error({ title: message });
                return null;
            }

            sileo.error({
                title: 'Failed to create trajectory',
                description: 'Please check your files and try again.'
            });
            return null;
        }
    }, [mutation, setUploadProgress, setUploadStatus, removeUpload]);

    return createTrajectory;
};

export default useCreateTrajectory;
