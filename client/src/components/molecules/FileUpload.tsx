import React, { useRef, useEffect } from 'react';
import Loader from '../atoms/Loader';
import useTrajectoryUpload from '../../hooks/useTrajectoryUpload';
import type { FileWithPath } from '../../hooks/useTrajectoryUpload';

interface FileUploadProps{
    onUploadSuccess?: (res: any) => void;
    onUploadError?: (err: any) => void;
    analysisConfig: any;
    className?: string;
    children?: React.ReactNode;
}

const FileUpload: React.FC<FileUploadProps> = ({
    onUploadSuccess,
    onUploadError,
    analysisConfig,
    className = '',
    children,
}) => {
    const { uploadAndProcessTrajectory, isLoading, error, data } = useTrajectoryUpload();
    const dropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(data){
            onUploadSuccess?.(data);
        }
    }, [data, onUploadSuccess]);

    useEffect(() => {
        if(error){
            onUploadError?.(error);
        }
    }, [error, onUploadError]);

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if(isLoading) return;

        const items = event.dataTransfer.items;
        if(!items) return;

        try{
            const filesWithPaths: FileWithPath[] = []; 
            let originalFolderName: string | null = null;

            const processEntry = async (entry: any): Promise<void> => {
                if(entry.isFile){
                    const file = await new Promise<File>((resolve) => entry.file(resolve));
                    const relativePath = entry.fullPath.startsWith('/') ? entry.fullPath.slice(1) : entry.fullPath;
                    filesWithPaths.push({ file, path: relativePath });

                    if(!originalFolderName && entry.fullPath){
                        const pathParts = entry.fullPath.split('/').filter((part) => part);
                        if(pathParts.length > 1){
                            originalFolderName = pathParts[0];
                        }
                    }
                }else if(entry.isDirectory){
                    if(!originalFolderName && entry.fullPath){
                        const pathParts = entry.fullPath.split('/').filter((part) => part);
                        if(pathParts.length > 0){
                            originalFolderName = pathParts[0];
                        }
                    }

                    const dirReader = entry.createReader();
                    const entries = await new Promise<any[]>((resolve) => dirReader.readEntries(resolve));
                    for(const subEntry of entries){
                        await processEntry(subEntry);
                    }
                }
            };

            for(let i = 0; i < items.length; i++){
                const item = items[i].webkitGetAsEntry();
                if(item){
                    await processEntry(item);
                }
            }

            if(filesWithPaths.length > 0 && originalFolderName){
                await uploadAndProcessTrajectory(filesWithPaths, originalFolderName, analysisConfig);
            }else{
                console.warn('No files were found or the parent folder could not be determined.');
            }
        }catch(err){
            console.error(err);
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    return (
        <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={'file-upload-container '.concat(className)}
        >
            {children}
            {isLoading && (
                <div className='file-upload-loader-container'>
                    <Loader scale={0.78} />
                    <p className='file-upload-loader-progress'>Processing...</p>
                </div>
            )}
        </div>
    );
};

export default FileUpload;