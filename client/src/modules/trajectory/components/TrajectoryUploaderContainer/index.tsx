import useTrajectoryUpload from '@/modules/trajectory/hooks/trajectory/use-trajectory-upload';
import { useCallback } from 'react';
import FileUploaderContainer, { type FileDropUpload } from '@/shared/presentation/components/FileUploaderContainer';
import { useLocalGlbStore } from '@/modules/canvas/stores/use-local-glb-store';
import { useNavigate } from 'react-router-dom';

interface TrajectoryUploaderContainerProps {
    children?: React.ReactNode;
}

export default function TrajectoryUploaderContainer({ children }: TrajectoryUploaderContainerProps) {
    const { uploadTrajectory } = useTrajectoryUpload();
    const navigate = useNavigate();
    const setLocalGlbFile = useLocalGlbStore((s) => s.setLocalGlbFile);

    const handleFilesDropped = useCallback((uploads: FileDropUpload[]) => {
        const droppedGlb = uploads
            .flatMap(({ files }) => files)
            .find(({ file }) => {
                const name = file.name.toLowerCase();
                return name.endsWith('.glb') || file.type === 'model/gltf-binary';
            });

        if (droppedGlb) {
            setLocalGlbFile(droppedGlb.file);
            navigate('/canvas/glb');
            return;
        }

        void Promise.allSettled(
            uploads.map(({ files, folderName }) => uploadTrajectory(files, folderName))
        );
    }, [navigate, setLocalGlbFile, uploadTrajectory]);

    return (
        <FileUploaderContainer onFilesDropped={handleFilesDropped}>
            {children}
        </FileUploaderContainer>
    );
}
