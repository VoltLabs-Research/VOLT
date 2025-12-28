/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { processFileSystemEntry } from '@/utilities/fs/process-file-system-entry';
import type { FileWithPath } from '@/hooks/trajectory/use-trajectory-upload';
import useDragState from '@/hooks/ui/drag-drop/use-drag-state';
import useFileUpload from '@/hooks/ui/drag-drop/use-file-upload';
import useLogger from '@/hooks/core/use-logger';
import Container from '@/components/primitives/Container';
import './FileUpload.css';

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
