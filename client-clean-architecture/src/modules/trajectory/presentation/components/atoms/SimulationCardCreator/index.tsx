import { useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import useTrajectoryUpload, { type FileWithPath } from '../../../hooks/trajectory/use-trajectory-upload';
import { LuUpload } from 'react-icons/lu';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './SimulationCardCreator.css';

interface SimulationCardCreatorProps{
    className?: string;
};

const SimulationCardCreator = ({ className = '' }: SimulationCardCreatorProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const { uploadTrajectory, isUploading } = useTrajectoryUpload();

    const handleFiles = useCallback((fileList: FileList) => {
        const filesWithPaths: FileWithPath[] = [];
        let folderName = '';

        for(let i = 0; i < fileList.length; i++){
            const file = fileList[i];
            const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
            
            if(!folderName && relativePath.includes('/')){
                folderName = relativePath.split('/')[0];
            }

            filesWithPaths.push({ file, path: relativePath });
        }

        if(!folderName && filesWithPaths.length > 0){
            folderName = filesWithPaths[0].file.name.replace(/\.[^/.]+$/, '');
        }

        if(filesWithPaths.length > 0){
            uploadTrajectory(filesWithPaths, folderName);
        }
    }, [uploadTrajectory]);

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if(e.dataTransfer.files.length > 0){
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    }, []);

    const handleClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if(e.target.files && e.target.files.length > 0){
            handleFiles(e.target.files);
        }
    }, [handleFiles]);

    return (
        <Container
            className={`d-flex column flex-center gap-075 simulation-card-creator radius-md cursor-pointer ${isUploading ? 'uploading' : ''} ${className}`}
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <input
                ref={inputRef}
                type='file'
                multiple
                onChange={handleChange}
                className='d-none'
            />
            <LuUpload className='upload-icon font-size-5 color-muted' />
            <Paragraph className='font-size-2 color-secondary'>
                {isUploading ? 'Uploading...' : 'Drop files or click to upload'}
            </Paragraph>
        </Container>
    );
};

export default SimulationCardCreator;
