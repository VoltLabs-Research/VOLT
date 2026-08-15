import { useDownloadTrajectoryAnalysesMutation } from './queries';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import useBlobDownload from '@/shared/ui/hooks/use-blob-download';

import type { DownloadTrajectoryAnalysesInput } from '../../api/services/trajectory-service';

const DOWNLOAD_ANALYSES_TOAST = createPromiseToastOptions({
    loading: 'Downloading analyses...',
    success: 'Analyses downloaded successfully',
    error: 'Failed to download analyses'
});

const buildFilename = ({ filename, trajectoryId }: DownloadTrajectoryAnalysesInput): string => {
    return `${filename || trajectoryId}-analyses.zip`;
};

const useDownloadTrajectoryAnalyses = () => {
    const { download, isDownloading } = useBlobDownload(useDownloadTrajectoryAnalysesMutation(), {
        toast: DOWNLOAD_ANALYSES_TOAST,
        filename: buildFilename
    });

    return {
        downloadTrajectoryAnalyses: download,
        isDownloading
    };
};

export default useDownloadTrajectoryAnalyses;
