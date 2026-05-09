import useCreateTrajectory from './use-create-trajectory';
import { buildFileFormData } from '@/shared/utils/file';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback, useState } from 'react';
import type { FileWithPath } from '@/shared/utils/file';
import type { Trajectory } from '../../api/entities/trajectory/trajectory';

const UPLOAD_TRAJECTORY_TOAST = {
    loading: { title: 'Uploading...' },
    success: { title: 'Upload received, processing started' },
    error: {
        title: 'Failed to upload trajectory',
        description: 'Please check your files and try again.'
    }
};

interface UseTrajectoryUploadResult {
    uploadTrajectory: (files: FileWithPath[], folderName: string) => Promise<void>;
    isUploading: boolean;
}

export default function useTrajectoryUpload(folderId?: string | null): UseTrajectoryUploadResult {
    const [isUploading, setIsUploading] = useState(false);
    const createTrajectory = useCreateTrajectory();

    const uploadTrajectory = useCallback(async (files: FileWithPath[], folderName: string) => {
        if (files.length === 0) return;

        setIsUploading(true);

        try {
            const formData = buildFileFormData(
                files.map(({ file }) => ({ name: 'trajectoryFiles', file })),
                { name: folderName }
            );

            if (folderId) {
                formData.append('folderId', folderId);
            }

            const uploadPromise: Promise<Trajectory> = createTrajectory(formData);
            await showPromise(uploadPromise, UPLOAD_TRAJECTORY_TOAST);
        } finally {
            setIsUploading(false);
        }
    }, [createTrajectory, folderId]);

    return { uploadTrajectory, isUploading };
}
