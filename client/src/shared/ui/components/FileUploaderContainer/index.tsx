import { cn } from '@heroui/react';
import { describeSkippedEntries, processFileSystemEntry } from '@/shared/utils/file';
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { sileo } from 'sileo';
import type { FileWithPath } from '@/shared/utils/file';

export interface FileDropUpload {
    files: FileWithPath[];
    folderName: string;
};

interface FileUploaderContainerProps {
    children?: React.ReactNode;
    onFilesDropped: (uploads: FileDropUpload[]) => void;
};

interface ProcessedDropEntry {
    files: FileWithPath[];
    folderName: string | null;
    skippedPaths: string[];
    isDirectory: boolean;
};

/**
 * A full-window overlay that is invisible and inert until a drag carrying files
 * enters the window, then fades in a tinted, blurred sheet with an accent edge.
 */
const DROP_ZONE_CLASSES = 'absolute w-full h-full top-0 left-0 z-[100] border border-transparent bg-transparent backdrop-blur-[0px] opacity-0 pointer-events-none transition-[opacity,background-color,backdrop-filter,border-color] duration-300 ease-out';
const DROP_ZONE_ACTIVE_CLASSES = 'opacity-100 pointer-events-auto border-accent bg-accent/10 backdrop-blur-[3px]';

const createFallbackUploadName = (timestamp: number, index: number): string => {
    return index === 0 ? `upload_${timestamp}` : `upload_${timestamp}_${index}`;
};

const buildDropUploads = (entries: ProcessedDropEntry[]): FileDropUpload[] => {
    const timestamp = Date.now();
    const uploads: FileDropUpload[] = [];
    const looseFiles: FileWithPath[] = [];
    let looseFolderName: string | null = null;

    entries.forEach(({ files, folderName, isDirectory }) => {
        if (files.length === 0) {
            return;
        }

        if (isDirectory) {
            uploads.push({
                files,
                folderName: folderName || createFallbackUploadName(timestamp, uploads.length)
            });
            return;
        }

        looseFiles.push(...files);
        if (!looseFolderName && folderName) {
            looseFolderName = folderName;
        }
    });

    if (looseFiles.length > 0) {
        uploads.push({
            files: looseFiles,
            folderName: looseFolderName || createFallbackUploadName(timestamp, uploads.length)
        });
    }

    return uploads;
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
            const processPromises = Array.from(items).map(async (item) => {
                const entry = item.webkitGetAsEntry();
                if (!entry) return null;
                const result = await processFileSystemEntry(entry);
                return {
                    ...result,
                    isDirectory: entry.isDirectory
                };
            });

            const results = (await Promise.all(processPromises)).filter(
                (result): result is ProcessedDropEntry => result !== null
            );

            const skippedNotice = describeSkippedEntries(
                results.flatMap((result) => result.skippedPaths)
            );
            if (skippedNotice) {
                sileo.error({
                    title: 'Some dropped items were skipped',
                    description: skippedNotice
                });
            }

            const uploads = buildDropUploads(results);

            if (uploads.length === 0) {
                return;
            }

            onFilesDropped(uploads);
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
        return cn(DROP_ZONE_CLASSES, isDraggingOver && DROP_ZONE_ACTIVE_CLASSES);
    }, [isDraggingOver]);

    const dragMessage = isDraggingOver ? 'Drop files to upload them.' : '';

    const dropZone = (
        <div ref={dropRef} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDropZoneDragLeave} className={containerClasses} aria-label='File upload drop zone' role='region' aria-live='polite' aria-atomic='true'>
            <span className='sr-only'>{dragMessage}</span>
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
