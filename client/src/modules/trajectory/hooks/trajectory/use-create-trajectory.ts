import useTrajectoryStore from '../../stores/trajectory/use-trajectory-store';
import { trajectoryQuery } from './queries';
import { handleActionError } from '@/shared/errors/handled-action';
import { v4 } from 'uuid';
import { useCallback, useEffect, useRef } from 'react';
import type { Trajectory } from '../../api/entities/trajectory';

export default function useCreateTrajectory() {
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
            return result;
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

            handleActionError(error, {
                accessDeniedTitle: 'You do not have permission to create trajectories',
                errorToast: {
                    title: 'Failed to create trajectory',
                    description: 'Please check your files and try again.'
                }
            });
            return null;
        }
    }, [mutation, setUploadProgress, setUploadStatus, removeUpload]);

    return createTrajectory;
}
