/**
 * Download adapter interface.
 */
export interface IDownloadAdapter {
    downloadBlob(blob: Blob, filename: string): void;
    downloadUrl(url: string, filename: string): void;
}

/**
 * Browser-based download adapter.
 * Encapsulates DOM operations for file downloads.
 */
export class BrowserDownloadAdapter implements IDownloadAdapter {
    /**
     * Downloads a blob as a file.
     *
     * @param blob - Blob to download
     * @param filename - Target filename
     */
    downloadBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);

        try {
            this.downloadUrl(url, filename);
        } finally {
            // Clean up object URL after download starts
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }

    /**
     * Downloads from a URL.
     *
     * @param url - URL to download from
     * @param filename - Target filename
     */
    downloadUrl(url: string, filename: string): void {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }
}
