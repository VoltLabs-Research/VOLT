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

interface BuildFileFormDataEntry {
    name: string;
    file: File;
};

export const buildFileFormData = (
    files: BuildFileFormDataEntry[],
    fields?: Record<string, string>
): FormData => {
    const formData = new FormData();

    Object.entries(fields ?? {}).forEach(([key, value]) => {
        formData.append(key, value);
    });

    files.forEach(({ name, file }) => {
        formData.append(name, file);
    });

    return formData;
};

export const triggerBrowserDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export interface FileWithPath {
    file: File;
    path: string;
};

const extractFolderName = (fullPath: string): string | null => {
    if (!fullPath) return null;
    const pathParts = fullPath.split('/').filter((part) => part.trim() !== '');
    return pathParts.length > 0 ? pathParts[0] : null;
};

const readDirectoryEntries = async (dirEntry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> => {
    const dirReader = dirEntry.createReader();
    const entries: FileSystemEntry[] = [];

    while (true) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
            dirReader.readEntries(resolve, reject);
        });

        if (batch.length === 0) {
            break;
        }

        entries.push(...batch);
    }

    return entries;
};

export const processFileSystemEntry = async (
    entry: FileSystemEntry
): Promise<{ files: FileWithPath[]; folderName: string | null }> => {
    const files: FileWithPath[] = [];
    let folderName: string | null = null;

    const processEntry = async (currentEntry: FileSystemEntry): Promise<void> => {
        if (currentEntry.isFile) {
            const fileEntry = currentEntry as FileSystemFileEntry;
            try {
                const file = await new Promise<File>((resolve, reject) => {
                    fileEntry.file(resolve, reject);
                });

                const relativePath = currentEntry.fullPath.startsWith('/')
                    ? currentEntry.fullPath.slice(1)
                    : currentEntry.fullPath;

                files.push({ file, path: relativePath });

                if (!folderName) {
                    folderName = extractFolderName(currentEntry.fullPath);
                }
            } catch {
            }
        } else if (currentEntry.isDirectory) {
            const dirEntry = currentEntry as FileSystemDirectoryEntry;
            if (!folderName) {
                folderName = extractFolderName(currentEntry.fullPath);
            }

            try {
                const entries = await readDirectoryEntries(dirEntry);

                await Promise.all(entries.map((subEntry) => processEntry(subEntry)));
            } catch {
            }
        }
    };

    await processEntry(entry);
    return { files, folderName };
};
