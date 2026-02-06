import { useCallback, useState } from 'react';
import useTrajectoryUseCases from './use-trajectory-use-cases';
import { triggerBrowserDownload } from '@/shared/utils/file';

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
            const files = await trajectoryRepository.listSamples();
            for(const filename of files){
                const blob = await trajectoryRepository.downloadSample(filename);
                triggerBrowserDownload(blob, filename);
            }
        }finally{
            setIsDownloading(false);
        }
    }, [trajectoryRepository]);

    return { downloadAllSamples, isDownloading };
};

export default useDownloadSamples;
