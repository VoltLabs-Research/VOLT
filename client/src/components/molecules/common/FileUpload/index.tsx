import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { processFileSystemEntry } from '@/utilities/common/fs/process-file-system-entry';
import type { FileWithPath } from '@/features/trajectory/hooks/use-trajectory-upload';
import useDragState from '@/hooks/ui/drag-drop/use-drag-state';
import useFileUpload from '@/hooks/ui/drag-drop/use-file-upload';
import useLogger from '@/hooks/core/use-logger';
import Container from '@/components/primitives/Container';
import '@/components/molecules/common/FileUpload/FileUpload.css';

interface FileUploadProps{
    children?: React.ReactNode;
}

const FileUpload: React.FC<FileUploadProps> = ({
    children,
}) => {
    const dropRef = useRef<HTMLDivElement>(null);
    const { isDraggingOver, handleDragEnter, handleDragLeave, resetDragState } = useDragState();
    const { uploadFiles } = useFileUpload();
    const logger = useLogger('file-upload');

    const handleWindowDragEnter = useCallback((event: DragEvent) => {
        event.preventDefault();
        if(!event.dataTransfer?.types.includes('Files')){
            return;
        }

        handleDragEnter();
    }, [handleDragEnter]);

    const handleDrop = useCallback(async(event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        resetDragState();

        const items = event.dataTransfer.items;
        if(!items || items.length === 0){
            logger.warn('No items found in drop event');
            return;
        }

        try{
            const allFiles: FileWithPath[] = [];
            let commonFolderName: string | null = null;

            const processPromises = Array.from(items).map(async(item) => {
                const entry = item.webkitGetAsEntry();
                if(!entry) return { files: [], folderName: null };

                return processFileSystemEntry(entry);
            });

            const results = await Promise.all(processPromises);
            results.forEach(({ files, folderName }) => {
                allFiles.push(...files);
                if(!commonFolderName && folderName){
                    commonFolderName = folderName;
                }
            });

            if(allFiles.length === 0){
                const error = new Error('No files found in dropped items');
                logger.warn(error.message);
                return;
            }

            const finalFolderName = commonFolderName || `upload_${Date.now()}`;
            logger.log(`Processing ${allFiles.length} files from folder: ${finalFolderName}`);

            await uploadFiles(allFiles, finalFolderName);
        }catch(err){
            const error = err instanceof Error ? err : new Error('Failed to process dropped files');
            logger.error('Drop handler error:', error);
        }
    }, [uploadFiles, resetDragState]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    }, []);

    const handleDropZoneDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        handleDragLeave();
    }, [handleDragLeave]);

    useEffect(() => {
        window.addEventListener('dragenter', handleWindowDragEnter);

        return() => {
            window.removeEventListener('dragenter', handleWindowDragEnter);
        };
    }, [handleWindowDragEnter]);

    const containerClasses = useMemo(() => {
        const classes = ['file-upload-container', 'p-absolute', 'w-max', 'h-max'];

        if(isDraggingOver) classes.push('is-dragging-over');

        return classes.filter(Boolean).join(' ');
    }, [isDraggingOver]);

    const dropZone = (
        <Container
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDropZoneDragLeave}
            className={containerClasses}
            aria-label="File upload drop zone"
            role="button"
        />
    );

    return(
        <>
            {children}
            {createPortal(dropZone, document.body)}
        </>

    );
};

export default FileUpload;
