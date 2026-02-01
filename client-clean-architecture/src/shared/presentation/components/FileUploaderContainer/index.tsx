import { useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useDragState from '@/shared/presentation/hooks/use-drag-state';
import { processFileSystemEntry, type FileWithPath } from '@/shared/utils/file';
import Container from '@/shared/presentation/components/Container';
import './FileUploaderContainer.css';

interface FileUploaderContainerProps {
    children?: React.ReactNode;
    onFilesDropped: (files: FileWithPath[], folderName: string) => void;
};

const FileUploaderContainer: React.FC<FileUploaderContainerProps> = ({
    children,
    onFilesDropped
}) => {
    const dropRef = useRef<HTMLDivElement>(null);
    const { isDraggingOver, handleDragEnter, handleDragLeave, resetDragState } = useDragState();

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
        } catch (err) {
            console.error('Drop handler error:', err);
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

    const dropZone = (
        <Container
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDropZoneDragLeave}
            className={containerClasses}
            aria-label='File upload drop zone'
            role='button'
        />
    );

    return (
        <>
            {children}
            {createPortal(dropZone, document.body)}
        </>
    );
};

export default FileUploaderContainer;
