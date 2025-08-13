export const downloadFromDataURL = (dataURL: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename || `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};