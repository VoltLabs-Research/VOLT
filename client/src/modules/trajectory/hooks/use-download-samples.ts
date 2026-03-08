import { useCallback, useState } from 'react';
import { fetchTrajectorySamples } from './trajectory/queries';
import { useDownloadSampleMutation } from './trajectory/queries';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { showPromise } from '@/shared/presentation/hooks/toast';

interface UseDownloadSamplesReturn {
    downloadAllSamples: () => Promise<void>;
    isDownloading: boolean;
}

const useDownloadSamples = (): UseDownloadSamplesReturn => {
    const [isDownloading, setIsDownloading] = useState(false);
    const downloadSampleMutation = useDownloadSampleMutation();

    const downloadAllSamples = useCallback(async () => {
        setIsDownloading(true);
        try {
            await showPromise(
                async () => {
                    const files = await fetchTrajectorySamples();

                    for (const filename of files) {
                        const blob = await downloadSampleMutation.mutateAsync({ filename });
                        triggerBrowserDownload(blob, filename);
                    }
                },
                {
                    loading: { title: 'Downloading samples...' },
                    success: { title: 'Samples downloaded' },
                    error: { title: 'Failed to download samples' }
                }
            );
        } finally {
            setIsDownloading(false);
        }
    }, [downloadSampleMutation]);

    return {
        downloadAllSamples,
        isDownloading
    };
};

export default useDownloadSamples;
