import { useState, useCallback, useRef } from 'react';

interface FilePreview {
    file: File;
    preview: string;
};

const useFilePreview = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<FilePreview[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const addFiles = useCallback(async (newFiles: File[]) => {
        if (!newFiles.length) return;

        setFiles((prev) => [...prev, ...newFiles]);

        const newPreviews = await Promise.all(
            newFiles.map((file) =>
                new Promise<FilePreview>((resolve) => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (ev) => resolve({ file, preview: ev.target?.result as string });
                        reader.readAsDataURL(file);
                    } else {
                        resolve({ file, preview: '' });
                    }
                })
            )
        );

        setPreviews((prev) => [...prev, ...newPreviews]);
    }, []);

    const removeFile = useCallback((index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
        setPreviews((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const clear = useCallback(() => {
        setFiles([]);
        setPreviews([]);
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files || []);
        await addFiles(newFiles);
        if (inputRef.current) inputRef.current.value = '';
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
