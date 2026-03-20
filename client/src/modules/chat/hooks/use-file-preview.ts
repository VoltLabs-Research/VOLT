import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { RefObject } from 'react';

interface FilePreview {
    file: File;
    preview: string;
};

interface UseFilePreviewReturn {
    files: File[];
    previews: FilePreview[];
    inputRef: RefObject<HTMLInputElement | null>;
    addFiles: (newFiles: File[]) => Promise<void>;
    removeFile: (index: number) => void;
    clear: () => void;
    handleInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    openFilePicker: () => void;
    hasFiles: boolean;
};

const getImagePreview = async (file: File): Promise<string> => {
    return await new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = reader.result;

            if (typeof result === 'string') {
                resolve(result);
                return;
            }

            resolve('');
        };

        reader.onerror = () => {
            resolve('');
        };

        reader.readAsDataURL(file);
    });
};

const useFilePreview = (): UseFilePreviewReturn => {
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<FilePreview[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const addFiles = useCallback(async (newFiles: File[]) => {
        if (newFiles.length === 0) {
            return;
        }

        setFiles((previousFiles) => [...previousFiles, ...newFiles]);

        const nextPreviews = await Promise.all(newFiles.map(async (file) => {
            return {
                file,
                preview: file.type.startsWith('image/') ? await getImagePreview(file) : ''
            };
        }));

        setPreviews((previousPreviews) => [...previousPreviews, ...nextPreviews]);
    }, []);

    const removeFile = useCallback((index: number) => {
        setFiles((previousFiles) => previousFiles.filter((_, currentIndex) => currentIndex !== index));
        setPreviews((previousPreviews) => previousPreviews.filter((_, currentIndex) => currentIndex !== index));
    }, []);

    const clear = useCallback(() => {
        setFiles([]);
        setPreviews([]);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    }, []);

    const handleInputChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const nextFiles = Array.from(event.target.files ?? []);
        await addFiles(nextFiles);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    }, [addFiles]);

    const openFilePicker = useCallback(() => {
        inputRef.current?.click();
    }, []);

    return {
        files,
        previews,
        inputRef,
        addFiles,
        removeFile,
        clear,
        handleInputChange,
        openFilePicker,
        hasFiles: files.length > 0
    };
};

export default useFilePreview;
