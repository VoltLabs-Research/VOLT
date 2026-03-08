import { useCallback, useRef } from 'react';
import useTrajectoryUpload from './use-trajectory-upload';
import type { FileWithPath } from '@/shared/utils/file';

interface UseTrajectoryFilePickerResult {
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handlePickerChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    openFilePicker: () => void;
    isUploading: boolean;
}

const resolveUploadName = (files: FileWithPath[]): string => {
    if (files.length === 0) return `upload_${Date.now()}`;
    const hasRelativePaths = files.some(({ path }) => path.includes('/'));

    if (hasRelativePaths) {
        const firstPathSegment = files[0].path.split('/').filter(Boolean)[0];
        return firstPathSegment || `upload_${Date.now()}`;
    }

    if (files.length === 1) {
        return files[0].file.name;
    }

    return `upload_${Date.now()}`;
};

const useTrajectoryFilePicker = (onAfterSelect?: () => void): UseTrajectoryFilePickerResult => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadTrajectory, isUploading } = useTrajectoryUpload();

    const handlePickerChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const selectedFiles = input.files;

        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }

        const filesWithPath: FileWithPath[] = Array.from(selectedFiles).map((file) => ({
            file,
            path: file.webkitRelativePath || file.name
        }));

        const uploadName = resolveUploadName(filesWithPath);
        onAfterSelect?.();
        try {
            await uploadTrajectory(filesWithPath, uploadName);
        } finally {
            input.value = '';
        }
    }, [uploadTrajectory, onAfterSelect]);

    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    return { fileInputRef, handlePickerChange, openFilePicker, isUploading };
};

export default useTrajectoryFilePicker;
