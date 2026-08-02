import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

interface FilePreview {
    file: File;
    preview: string;
}

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

const useFilePreview = () => {
    const [previews, setPreviews] = useState<FilePreview[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const clearInputValue = () => {
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const nextFiles = Array.from(event.target.files ?? []);

        if (nextFiles.length > 0) {
            const nextPreviews = await Promise.all(nextFiles.map(async (file) => ({
                file,
                preview: file.type.startsWith('image/') ? await getImagePreview(file) : ''
            })));

            setPreviews((previousPreviews) => [...previousPreviews, ...nextPreviews]);
        }

        clearInputValue();
    };

    const removeFile = (index: number) => {
        setPreviews((previousPreviews) => previousPreviews.filter((_, currentIndex) => currentIndex !== index));
    };

    const clear = () => {
        setPreviews([]);
        clearInputValue();
    };

    return {
        files: previews.map((item) => item.file),
        previews,
        inputRef,
        removeFile,
        clear,
        handleInputChange,
        openFilePicker: () => inputRef.current?.click(),
        hasFiles: previews.length > 0
    };
};

export default useFilePreview;
