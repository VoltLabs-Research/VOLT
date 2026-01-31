import { useRef, useCallback, useState, type DragEvent, type ChangeEvent, type ReactNode } from 'react';
import { LuUpload } from 'react-icons/lu';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { cn } from '@/shared/utils';
import './DragDropUploader.css';

export interface FileWithPath{
    file: File;
    path: string;
};

interface DragDropUploaderProps{
    onFilesSelected: (files: FileWithPath[]) => void;
    isUploading?: boolean;
    accept?: string;
    multiple?: boolean;
    directory?: boolean;
    className?: string;
    icon?: ReactNode;
    label?: string;
    uploadingLabel?: string;
};

const DragDropUploader = ({
    onFilesSelected,
    isUploading = false,
    accept,
    multiple = true,
    directory = false,
    className = '',
    icon,
    label = 'Drop files or click to upload',
    uploadingLabel = 'Uploading...'
}: DragDropUploaderProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const processFiles = useCallback((fileList: FileList): FileWithPath[] => {
        const filesWithPaths: FileWithPath[] = [];

        for(let i = 0; i < fileList.length; i++){
            const file = fileList[i];
            const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
            filesWithPaths.push({ file, path: relativePath });
        }

        return filesWithPaths;
    }, []);

    const handleFiles = useCallback((fileList: FileList) => {
        if(fileList.length === 0) return;
        const files = processFiles(fileList);
        onFilesSelected(files);
    }, [processFiles, onFilesSelected]);

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if(e.dataTransfer.files.length > 0){
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if(e.target.files && e.target.files.length > 0){
            handleFiles(e.target.files);
        }
    }, [handleFiles]);

    const containerClass = cn(
        'drag-drop-uploader d-flex column flex-center gap-075 radius-md cursor-pointer p-2',
        isUploading && 'is-uploading',
        isDragging && 'is-dragging',
        className
    );

    return (
        <Container
            className={containerClass}
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <input
                ref={inputRef}
                type='file'
                accept={accept}
                multiple={multiple}
                onChange={handleChange}
                className='d-none'
                {...(directory ? { webkitdirectory: '', directory: '' } : {})}
            />
            <Container className='drag-drop-icon d-flex font-size-5 color-muted'>
                {icon ?? <LuUpload />}
            </Container>
            <Paragraph className='font-size-2 color-secondary'>
                {isUploading ? uploadingLabel : label}
            </Paragraph>
        </Container>
    );
};

export default DragDropUploader;
