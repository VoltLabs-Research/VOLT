import { useCallback, useState } from 'react';
import useTrajectoryUseCases from './use-trajectory-use-cases';

interface UseDownloadSamplesReturn {
    downloadAllSamples: () => Promise<void>;
    isDownloading: boolean;
};

const useDownloadSamples = (): UseDownloadSamplesReturn => {
    const { trajectoryRepository } = useTrajectoryUseCases();
    const [isDownloading, setIsDownloading] = useState(false);

    const triggerBrowserDownload = useCallback((blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

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
    }, [trajectoryRepository, triggerBrowserDownload]);

    return { downloadAllSamples, isDownloading };
};

export default useDownloadSamples;
