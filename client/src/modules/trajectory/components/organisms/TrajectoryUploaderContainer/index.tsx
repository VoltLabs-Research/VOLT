import { useCallback } from 'react';
import FileUploaderContainer from '@/shared/presentation/components/FileUploaderContainer';
import useTrajectoryUpload from '@/modules/trajectory/hooks/use-trajectory-upload';
import type { FileWithPath } from '@/shared/utils/file';

interface TrajectoryUploaderContainerProps {
    children?: React.ReactNode;
};

const TrajectoryUploaderContainer: React.FC<TrajectoryUploaderContainerProps> = ({ children }) => {
    const { uploadTrajectory } = useTrajectoryUpload();

    const handleFilesDropped = useCallback((files: FileWithPath[], folderName: string) => {
        uploadTrajectory(files, folderName);
    }, [uploadTrajectory]);

    return (
        <FileUploaderContainer onFilesDropped={handleFilesDropped}>
            {children}
        </FileUploaderContainer>
    );
};

export default TrajectoryUploaderContainer;
