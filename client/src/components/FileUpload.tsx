import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '../services/api';
import Loader from './Loader';
import type { UploadResult } from '../types/index';

interface FileUploadProps{
    onUploadSuccess: (result: UploadResult) => void;
    onUploadError: (error: string) => void;
    children?: React.ReactNode;
    className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess, onUploadError, children, className = '' }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if(acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        setUploading(true);
        setUploadProgress(0);

        try{
            const result = await uploadFile(file, setUploadProgress);
            onUploadSuccess(result);
        }catch(error){
            onUploadError(error instanceof Error ? error.message : 'Error al subir archivo');
        }finally{
            setUploading(false);
            setUploadProgress(0);
        }
    }, [onUploadSuccess, onUploadError]);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: {
            'text/plain': ['.dump', '.lammpstrj', '.xyz'],
        },
        multiple: false,
        disabled: uploading,
        noClick: true,
        noKeyboard: true
    });

    return (
        <div {...getRootProps()} className={'file-upload-container '.concat(className)}>
            {children}
            <input {...getInputProps()} />
            {uploadProgress && (
                <div className='file-upload-loader-container'>
                    <Loader scale={0.78} />
                    <p className='file-upload-loader-progress'>Uploading... {uploadProgress}%</p>
                </div>
            )}
        </div>
    );
};