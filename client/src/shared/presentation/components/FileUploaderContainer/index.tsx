import { processFileSystemEntry } from '@/shared/utils/file';
import './FileUploaderContainer.css';
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { sileo } from 'sileo';
import type { FileWithPath } from '@/shared/utils/file';

interface FileUploaderContainerProps {
    children?: React.ReactNode;
    onFilesDropped: (files: FileWithPath[], folderName: string) => void;
};

const FileUploaderContainer = ({
    children,
    onFilesDropped
}: FileUploaderContainerProps) => {
    const dropRef = useRef<HTMLDivElement>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const dragCounterRef = useRef(0);

    const handleDragEnter = useCallback(() => {
        dragCounterRef.current += 1;
        setIsDraggingOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        setIsDraggingOver(dragCounterRef.current > 0);
    }, []);

    const resetDragState = useCallback(() => {
        dragCounterRef.current = 0;
        setIsDraggingOver(false);
    }, []);

    const handleWindowDragEnter = useCallback((event: DragEvent) => {
        event.preventDefault();
        if (!event.dataTransfer?.types.includes('Files')) {
            return;
        }
        handleDragEnter();
    }, [handleDragEnter]);

    const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        resetDragState();

        const items = event.dataTransfer.items;
        if (!items || items.length === 0) {
            return;
        }

        try {
            const allFiles: FileWithPath[] = [];
            let commonFolderName: string | null = null;

            const processPromises = Array.from(items).map(async (item) => {
                const entry = item.webkitGetAsEntry();
                if (!entry) return { files: [], folderName: null };
                return processFileSystemEntry(entry);
            });

            const results = await Promise.all(processPromises);
            results.forEach(({ files, folderName }) => {
                allFiles.push(...files);
                if (!commonFolderName && folderName) {
                    commonFolderName = folderName;
                }
            });

            if (allFiles.length === 0) {
                return;
            }

            const finalFolderName = commonFolderName || `upload_${Date.now()}`;
            onFilesDropped(allFiles, finalFolderName);
        } catch {
            sileo.error({ title: 'Failed to process dropped files' });
        }
    }, [onFilesDropped, resetDragState]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    }, []);

    const handleDropZoneDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        handleDragLeave();
    }, [handleDragLeave]);

    useEffect(() => {
        window.addEventListener('dragenter', handleWindowDragEnter);
        return () => {
            window.removeEventListener('dragenter', handleWindowDragEnter);
        };
    }, [handleWindowDragEnter]);

    const containerClasses = useMemo(() => {
        const classes = ['file-uploader-container', 'p-absolute', 'w-max', 'h-max'];
        if (isDraggingOver) classes.push('is-dragging-over');
        return classes.join(' ');
    }, [isDraggingOver]);

    const dragMessage = isDraggingOver ? 'Drop files to upload them.' : '';

    const dropZone = (
        <div ref={dropRef} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDropZoneDragLeave} className={containerClasses} aria-label='File upload drop zone' role='region' aria-live='polite' aria-atomic='true'>
            <span className='file-uploader-live-region'>{dragMessage}</span>
        </div>
    );

    return (
        <>
            {children}
            {createPortal(dropZone, document.body)}
        </>
    );
};

export default FileUploaderContainer;
