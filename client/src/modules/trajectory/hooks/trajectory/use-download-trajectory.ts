import { useDownloadTrajectoryMutation } from './queries';
import { isAccessDeniedError } from '@/shared/errors/core';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback } from 'react';

import type { DownloadTrajectoryInputDTO } from '../../api/services/trajectory-service';

interface UseDownloadTrajectoryReturn {
    downloadTrajectory: (params: DownloadTrajectoryInputDTO) => Promise<void>;
    isDownloading: boolean;
}

const useDownloadTrajectory = (): UseDownloadTrajectoryReturn => {
    const downloadTrajectoryMutation = useDownloadTrajectoryMutation();

    const downloadTrajectory = useCallback(async (params: DownloadTrajectoryInputDTO) => {
        try {
            await showPromise(
                (async () => {
                    const blob = await downloadTrajectoryMutation.mutateAsync({
                        ...params,
                        archive: params.archive ?? true
                    });
                    const extension = blob.type.includes('zip')
                        ? 'zip'
                        : blob.type.includes('gzip')
                            ? 'dump.gz'
                            : 'dump';
                    const filename = `${params.filename || params.trajectoryId}.${extension}`;
                    triggerBrowserDownload(blob, filename);
                    return blob;
                })(),
                {
                    loading: { title: 'Exporting trajectory...' },
                    success: { title: 'Trajectory exported successfully' },
                    error: { title: 'Failed to export trajectory' }
                }
            );
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) return;
        }
    }, [downloadTrajectoryMutation]);

    return {
        downloadTrajectory,
        isDownloading: downloadTrajectoryMutation.isPending
    };
};

export default useDownloadTrajectory;
