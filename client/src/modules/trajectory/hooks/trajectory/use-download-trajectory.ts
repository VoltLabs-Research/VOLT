import { useDownloadTrajectoryMutation } from './queries';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import useBlobDownload from '@/shared/ui/hooks/use-blob-download';

import type { DownloadTrajectoryInput } from '../../api/services/trajectory-service';

const EXPORT_TRAJECTORY_TOAST = createPromiseToastOptions({
    loading: 'Exporting trajectory...',
    success: 'Trajectory exported successfully',
    error: 'Failed to export trajectory'
});

const buildFilename = ({ filename, trajectoryId }: DownloadTrajectoryInput, blob: Blob): string => {
    if (blob.type.includes('zip')) return `${filename || trajectoryId}.zip`;
    if (blob.type.includes('gzip')) return `${filename || trajectoryId}.dump.gz`;

    return `${filename || trajectoryId}.dump`;
};

const useDownloadTrajectory = () => {
    const { download, isDownloading } = useBlobDownload(useDownloadTrajectoryMutation(), {
        toast: EXPORT_TRAJECTORY_TOAST,
        filename: buildFilename
    });

    return {
        downloadTrajectory: download,
        isDownloading
    };
};

export default useDownloadTrajectory;
