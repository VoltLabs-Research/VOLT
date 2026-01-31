import { useCallback } from 'react';
import useTrajectoryUpload from '../../../hooks/trajectory/use-trajectory-upload';
import DragDropUploader, { type FileWithPath } from '@/shared/presentation/components/DragDropUploader';
import './SimulationCardCreator.css';

interface SimulationCardCreatorProps{
    className?: string;
};

const SimulationCardCreator = ({ className = '' }: SimulationCardCreatorProps) => {
    const { uploadTrajectory, isUploading } = useTrajectoryUpload();

    const handleFilesSelected = useCallback((files: FileWithPath[]) => {
        if(files.length === 0) return;

        let folderName = '';
        const firstPath = files[0].path;

        if(firstPath.includes('/')){
            folderName = firstPath.split('/')[0];
        }else{
            folderName = files[0].file.name.replace(/\.[^/.]+$/, '');
        }

        uploadTrajectory(files, folderName);
    }, [uploadTrajectory]);

    return (
        <DragDropUploader
            onFilesSelected={handleFilesSelected}
            isUploading={isUploading}
            multiple
            directory
            className={`simulation-card-creator ${className}`}
        />
    );
};

export default SimulationCardCreator;
