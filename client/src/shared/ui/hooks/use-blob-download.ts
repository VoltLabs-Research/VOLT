import { showPromise } from '@/shared/ui/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback } from 'react';

import type { PromiseToastOptions } from '@/shared/ui/utils/toast-options';
import type { UseMutationResult } from '@tanstack/react-query';

interface BlobDownloadOptions<TParams> {
    toast: PromiseToastOptions;
    filename: (params: TParams, blob: Blob) => string;
}

interface BlobDownload<TParams> {
    download: (params: TParams) => Promise<void>;
    isDownloading: boolean;
}

const useBlobDownload = <TParams,>(
    mutation: UseMutationResult<Blob, Error, TParams>,
    { toast, filename }: BlobDownloadOptions<TParams>
): BlobDownload<TParams> => {
    const download = useCallback(async (params: TParams): Promise<void> => {
        try {
            await showPromise(
                (async () => {
                    const blob = await mutation.mutateAsync(params);
                    triggerBrowserDownload(blob, filename(params, blob));
                    return blob;
                })(),
                toast
            );
        } catch {
        }
    }, [mutation, filename, toast]);

    return {
        download,
        isDownloading: mutation.isPending
    };
};

export default useBlobDownload;
