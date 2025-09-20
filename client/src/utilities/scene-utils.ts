export const downloadFromDataURL = (dataURL: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename || `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const formatSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const value = bytes / Math.pow(1024, i)
    return `${value.toFixed(2).replace(/\.?0+$/, '')} ${units[i]}`
}

export const formatNumber = (n?: number) => {
    if(Number.isFinite(n)){
        return new Intl.NumberFormat().format(n as number);
    }

    return '-';
};