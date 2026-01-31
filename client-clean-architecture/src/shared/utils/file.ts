export const base64ToBlob = (base64: string, fallbackMime: string = 'image/png'): Blob => {
    const parts = base64.split(',');
    const base64Data = parts[1] ?? parts[0];
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mimeString = mimeMatch?.[1] ?? fallbackMime;

    const byteString = atob(base64Data);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for(let i = 0; i < byteString.length; i++){
        uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mimeString });
};

export const blobToObjectUrl = (blob: Blob): string => {
    return URL.createObjectURL(blob);
};

export const base64ToBlobUrl = (base64: string, fallbackMime?: string): string => {
    const blob = base64ToBlob(base64, fallbackMime);
    return blobToObjectUrl(blob);
};
