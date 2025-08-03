/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useTrajectoryUpload from '@/hooks/trajectory/useTrajectoryUpload';
import useTeamStore from '@/stores/team';
import type { FileWithPath } from '@/hooks/trajectory/useTrajectoryUpload';
import useEditorStore from '@/stores/editor';
import './FileUpload.css';

interface FileUploadProps{
    onUploadSuccess?: (res: any) => void;
    className?: string;
    children?: React.ReactNode;
}

const FileUpload: React.FC<FileUploadProps> = ({
    onUploadSuccess,
    className = '',
    children,
}) => {
    const { uploadAndProcessTrajectory, error, data } = useTrajectoryUpload();
    const { analysisConfig } = useEditorStore((state) => state.analysisConfig);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const dropRef = useRef<HTMLDivElement>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    useEffect(() => {
        const handleWindowDragEnter = (event: DragEvent) => {
            event.preventDefault();
            if(event.dataTransfer?.types.includes('Files')){
                setIsDraggingOver(true);
            }
        };

        window.addEventListener('dragenter', handleWindowDragEnter);

        return () => {
            window.removeEventListener('dragenter', handleWindowDragEnter);
        };
    }, []);

    useEffect(() => {
        if(data){
            onUploadSuccess?.(data);
        }
    }, [data, onUploadSuccess]);

    useEffect(() => {
        if(error){
            console.error(error);
        }
    }, [error]);

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDraggingOver(false);

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
                console.log(selectedTeam?._id)
                await uploadAndProcessTrajectory(filesWithPaths, originalFolderName, analysisConfig, selectedTeam?._id);
            }else{
                console.warn('No files were found or the parent folder could not be determined.');
            }
        }catch(err){
            console.error(err);
        }
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDraggingOver(false);
    }

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    return (
        <>
            {children}
            {createPortal(
                <div
                    ref={dropRef}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`file-upload-container ${className} ${isDraggingOver ? 'is-dragging-over' : ''}`.trim()}
                />
            , document.body)}
        </>

    );
};

export default FileUpload;