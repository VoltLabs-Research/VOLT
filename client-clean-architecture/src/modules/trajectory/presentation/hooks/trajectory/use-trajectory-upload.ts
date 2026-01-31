import { useCallback, useState } from 'react';
import useCreateTrajectory from './use-create-trajectory';

export interface FileWithPath{
    file: File;
    path: string;
};

interface UseTrajectoryUploadResult{
    uploadTrajectory: (files: FileWithPath[], folderName: string) => Promise<void>;
    isUploading: boolean;
};

const useTrajectoryUpload = (): UseTrajectoryUploadResult => {
    const [isUploading, setIsUploading] = useState(false);
    const createTrajectory = useCreateTrajectory();

    const uploadTrajectory = useCallback(async (files: FileWithPath[], folderName: string) => {
        if(files.length === 0) return;

        setIsUploading(true);

        try{
            const formData = new FormData();
            formData.append('name', folderName);

            files.forEach(({ file, path }) => {
                formData.append('files', file);
                formData.append('paths', path);
            });

            await createTrajectory(formData);
        }finally{
            setIsUploading(false);
        }
    }, [createTrajectory]);

    return { uploadTrajectory, isUploading };
};

export default useTrajectoryUpload;
