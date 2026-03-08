import { fetchTrajectorySamples } from './queries';
import { useDownloadSampleMutation } from './queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback, useState } from 'react';

interface UseDownloadSamplesReturn {
    downloadAllSamples: () => Promise<void>;
    isDownloading: boolean;
};

interface ToastState {
    title: string;
};

interface DownloadSamplesToastConfig {
    loading: ToastState;
    success: ToastState;
    error: ToastState;
};

const DOWNLOAD_SAMPLES_TOAST: DownloadSamplesToastConfig = {
    loading: { title: 'Downloading samples...' },
    success: { title: 'Samples downloaded' },
    error: { title: 'Failed to download samples' }
};

export default function useDownloadSamples(): UseDownloadSamplesReturn {
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
                DOWNLOAD_SAMPLES_TOAST
            );
        } finally {
            setIsDownloading(false);
        }
    }, [downloadSampleMutation]);

    return {
        downloadAllSamples,
        isDownloading
    };
}
