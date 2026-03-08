import { useCallback, useState } from 'react';
import useCreateTrajectory from './use-create-trajectory';
import { buildFileFormData } from '@/shared/utils/file';
import type { FileWithPath } from '@/shared/utils/file';

interface UseTrajectoryUploadResult {
    uploadTrajectory: (files: FileWithPath[], folderName: string) => Promise<void>;
    isUploading: boolean;
};

const useTrajectoryUpload = (): UseTrajectoryUploadResult => {
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

            files.forEach(({ path }) => {
                formData.append('paths', path);
            });

            await createTrajectory(formData);
        } finally {
            setIsUploading(false);
        }
    }, [createTrajectory]);

    return { uploadTrajectory, isUploading };
};

export default useTrajectoryUpload;
