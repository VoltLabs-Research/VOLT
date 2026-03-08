import useTrajectoryUpload from '@/modules/trajectory/hooks/trajectory/use-trajectory-upload';
import { useCallback } from 'react';
import FileUploaderContainer from '@/shared/presentation/components/FileUploaderContainer';
import type { FileWithPath } from '@/shared/utils/file';

interface TrajectoryUploaderContainerProps {
    children?: React.ReactNode;
};

export default function TrajectoryUploaderContainer({ children }: TrajectoryUploaderContainerProps) {
    const { uploadTrajectory } = useTrajectoryUpload();

    const handleFilesDropped = useCallback((files: FileWithPath[], folderName: string) => {
        uploadTrajectory(files, folderName);
    }, [uploadTrajectory]);

    return (
        <FileUploaderContainer onFilesDropped={handleFilesDropped}>
            {children}
        </FileUploaderContainer>
    );
}
