import React, { useState, useRef } from 'react';
import { uploadFolder, analyzeFolder } from '../services/api';
import Loader from './Loader';

interface FileUploadProps {
    onUploadSuccess?: (res: any) => void;
    onUploadError?: (err: any) => void;
    className?: string;
    children?: React.ReactNode;
}

const FileUpload: React.FC<FileUploadProps> = ({
    onUploadSuccess,
    onUploadError,
    className = '',
    children
}) => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [analyzing, setAnalyzing] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if(uploading) return;

        const items = event.dataTransfer.items;
        if(!items) return;

        const allFiles: File[] = [];

        const traverseFileTree = async (item: any, path = ''): Promise<void> => {
            if(item.isFile){
                const file = await new Promise<File>(resolve => item.file(resolve));
                Object.defineProperty(file, 'webkitRelativePath', {
                    value: path + file.name
                });
                allFiles.push(file);
            }else if(item.isDirectory){
                const dirReader = item.createReader();
                const readEntries = (): Promise<void> =>
                    new Promise((resolve) => {
                        dirReader.readEntries(async (entries: any[]) => {
                            for(const entry of entries){
                                await traverseFileTree(entry, path + item.name + '/');
                            }
                            resolve();
                        });
                    });
                await readEntries();
            }
        };

        setUploading(true);
        setUploadProgress(0);

        try {
            for(let i = 0; i < items.length; i++){
                const item = items[i].webkitGetAsEntry();
                if(item) await traverseFileTree(item);
            }

            const res = await uploadFolder(allFiles);
            onUploadSuccess?.(res);
            try{
                setUploadProgress(100);
                setUploading(false);
                setAnalyzing(true);
                await analyzeFolder(res.folder_id)
            }finally{
                setAnalyzing(false);
            }
        } catch (err){
            console.error('Upload failed', err);
            onUploadError?.(err);
        } finally {
            setUploading(false);
        }


    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    return (
        <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={'file-upload-container '.concat(className)}
        >
            {children}
            {(uploading || analyzing) && (
                <div className='file-upload-loader-container'>
                    <Loader scale={0.78} />
                    <p className='file-upload-loader-progress'>
                        {uploading ? (
                            <span>Uploading... {uploadProgress}%</span>
                        ) : (
                            <span>Analyzing dislocations...</span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};

export default FileUpload;