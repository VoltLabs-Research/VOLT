import useTrajectoryUpload from '@/modules/trajectory/hooks/trajectory/use-trajectory-upload';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUploaderContainer from '@/shared/presentation/components/FileUploaderContainer';
import { useLocalGlbStore } from '@/modules/canvas/stores/use-local-glb-store';
import type { FileWithPath } from '@/shared/utils/file';

interface TrajectoryUploaderContainerProps {
    children?: React.ReactNode;
};

export default function TrajectoryUploaderContainer({ children }: TrajectoryUploaderContainerProps) {
    const { uploadTrajectory } = useTrajectoryUpload();
    const navigate = useNavigate();
    const setLocalGlbFile = useLocalGlbStore((s) => s.setLocalGlbFile);

    const handleFilesDropped = useCallback((files: FileWithPath[], folderName: string) => {
        const droppedGlb = files.find(({ file }) => {
            const name = file.name.toLowerCase();
            return name.endsWith('.glb') || file.type === 'model/gltf-binary';
        });

        if (droppedGlb) {
            setLocalGlbFile(droppedGlb.file);
            navigate('/canvas/glb');
            return;
        }

        uploadTrajectory(files, folderName);
    }, [navigate, setLocalGlbFile, uploadTrajectory]);

    return (
        <FileUploaderContainer onFilesDropped={handleFilesDropped}>
            {children}
        </FileUploaderContainer>
    );
}
