import { useCallback, useState } from 'react';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { showPromise } from '@/shared/presentation/hooks/toast';

interface UseDownloadSamplesReturn {
    downloadAllSamples: () => Promise<void>;
    isDownloading: boolean;
};

const useDownloadSamples = (): UseDownloadSamplesReturn => {
    const { trajectoryRepository } = useTrajectoryUseCases();
    const [isDownloading, setIsDownloading] = useState(false);

    const downloadAllSamples = useCallback(async () => {
        setIsDownloading(true);
        try{
            await showPromise(
                async () => {
                    const files = await trajectoryRepository.listSamples();
                    for(const filename of files){
                        const blob = await trajectoryRepository.downloadSample(filename);
                        triggerBrowserDownload(blob, filename);
                    }
                },
                {
                    loading: { title: 'Downloading samples...' },
                    success: { title: 'Samples downloaded' },
                    error: { title: 'Failed to download samples' }
                }
            );
        }finally{
            setIsDownloading(false);
        }
    }, [trajectoryRepository]);

    return { downloadAllSamples, isDownloading };
};

export default useDownloadSamples;
