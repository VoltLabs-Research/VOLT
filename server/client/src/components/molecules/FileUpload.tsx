import React, { useState, useRef } from 'react';
import { uploadTrajectoryFiles, analyzeTrajectory } from '../../services/api';
import Loader from '../atoms/Loader';

interface FileUploadProps {
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
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (uploading || analyzing) return;

        const items = event.dataTransfer.items;
        if (!items) return;

        try {
            setUploading(true);
            const formData = new FormData();
            let originalFolderName: string | null = null;
            const processEntry = async (entry: any): Promise<void> => {
                if (entry.isFile) {
                    const file = await new Promise<File>(resolve => entry.file(resolve));
                    formData.append('files', file, entry.name);
                    if (!originalFolderName && entry.fullPath) {
                        const pathParts = entry.fullPath.split('/').filter(p => p);
                        if (pathParts.length > 1) {
                            originalFolderName = pathParts[0];
                        }
                    }
                } else if (entry.isDirectory) {
                    if (!originalFolderName && entry.fullPath) {
                        const pathParts = entry.fullPath.split('/').filter(p => p);
                        if (pathParts.length > 0) {
                            originalFolderName = pathParts[0];
                        }
                    }
                    const dirReader = entry.createReader();
                    const entries = await new Promise<any[]>(resolve => dirReader.readEntries(resolve));
                    for (const subEntry of entries) {
                        await processEntry(subEntry);
                    }
                }
            };
            
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if (item) {
                    await processEntry(item);
                }
            }

            if (originalFolderName) {
                formData.append('originalFolderName', originalFolderName);
            }
            
            console.log(`Subiendo la carpeta: ${originalFolderName || 'desconocida'}...`);
            const uploadResponse = await uploadTrajectoryFiles(formData);

            console.log('Subida completada:', uploadResponse);
            setUploading(false);
            
            setAnalyzing(true);
            const folderId = uploadResponse.data.folderId;
            console.log(`Iniciando análisis para la carpeta ${folderId}...`);
            await analyzeTrajectory(folderId, analysisConfig);
            console.log('Solicitud de análisis enviada.');

            onUploadSuccess?.(uploadResponse.data.simulationInfo);

        } catch (err) {
            console.error('Fallo en el proceso de subida o análisis:', err);
            onUploadError?.(err);
        } finally {
            setUploading(false);
            setAnalyzing(false);
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
                        {uploading ? 'Subiendo archivos...' : 'Iniciando análisis...'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default FileUpload;