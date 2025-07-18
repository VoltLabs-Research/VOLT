import { useState } from 'react';
import { createTrajectory } from '../services/api';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface FileWithPath{
    file: File;
    path: string;
}

const useTrajectoryUpload = () => {
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [error, setError] = useState<any>(null);
    const [data, setData] = useState<any>(null);

    const uploadAndProcessTrajectory = async (
        filesWithPaths: FileWithPath[], 
        originalFolderName: string,
        analysisConfig: any
    ) => {
        setStatus('uploading');
        setError(null);
        setData(null);

        const formData = new FormData();
        filesWithPaths.forEach(({ file, path }) => {
            formData.append('trajectoryFiles', file, path);
        });

        formData.append('originalFolderName', originalFolderName);
        formData.append('analysisConfig', JSON.stringify(analysisConfig));

        try{
            const response = await createTrajectory(formData);
            setData(response.data.data);
            setStatus('success');
            return response.data.data;
        }catch(err: any){
            const errorData = err.response?.data?.message || err.message;
            setError(errorData);
            setStatus('error');
            throw errorData;
        }
    };

    return {
        uploadAndProcessTrajectory,
        isLoading: status === 'uploading',
        isSuccess: status === 'success',
        isError: status === 'error',
        error,
        data
    }
};

export default useTrajectoryUpload;