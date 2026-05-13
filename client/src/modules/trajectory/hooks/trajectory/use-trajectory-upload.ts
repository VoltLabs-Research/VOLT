import useCreateTrajectory from './use-create-trajectory';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { useTrajectoryUploadProgressStore } from '@/modules/trajectory/stores/use-trajectory-upload-progress-store';
import trajectoryService from '@/modules/trajectory/api/services/trajectory-service';
import { uploadClusterObjectParts } from '@/modules/cluster-object/services/cluster-object-upload';
import { sileo } from 'sileo';
import { useCallback, useRef, useState } from 'react';
import type { CreateTrajectoryUploadSessionOutputDTO } from '@/modules/trajectory/api/services/trajectory-service';
import type { FileWithPath } from '@/shared/utils/file';

const UPLOAD_SUCCESS_TITLE = 'Upload received, processing started';
const UPLOAD_ERROR_TITLE = 'Failed to upload trajectory';
const UPLOAD_ERROR_DESCRIPTION = 'Please check your files and try again.';

interface UseTrajectoryUploadResult {
    uploadTrajectory: (files: FileWithPath[], folderName: string) => Promise<void>;
    isUploading: boolean;
}

const createUploadId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getTotalBytes = (files: FileWithPath[]): number => {
    return files.reduce((total, { file }) => total + file.size, 0);
};

const getUploadDisplayName = (files: FileWithPath[], folderName: string): string => {
    if (files.length === 1) {
        return files[0].file.name;
    }

    if (folderName && !folderName.startsWith('upload_')) {
        return `${folderName} (${files.length} files)`;
    }

    const firstFileName = files[0]?.file.name ?? 'Trajectory upload';
    return `${firstFileName} + ${files.length - 1} more`;
};

export default function useTrajectoryUpload(folderId?: string | null): UseTrajectoryUploadResult {
    const [isUploading, setIsUploading] = useState(false);
    const activeUploadsRef = useRef(0);
    const createTrajectory = useCreateTrajectory();
    const addUpload = useTrajectoryUploadProgressStore((state) => state.addUpload);
    const updateUploadProgress = useTrajectoryUploadProgressStore((state) => state.updateUploadProgress);
    const removeUpload = useTrajectoryUploadProgressStore((state) => state.removeUpload);

    const uploadTrajectory = useCallback(async (files: FileWithPath[], folderName: string) => {
        if (files.length === 0) return;

        const uploadId = createUploadId();
        const totalBytes = getTotalBytes(files);
        const displayName = getUploadDisplayName(files, folderName);

        activeUploadsRef.current += 1;
        setIsUploading(true);
        addUpload({
            id: uploadId,
            name: displayName,
            fileCount: files.length,
            totalBytes
        });

        let session: CreateTrajectoryUploadSessionOutputDTO | null = null;

        try {
            session = await createTrajectory({
                name: folderName,
                ...(folderId ? { folderId } : {}),
                files: files.map(({ file }) => ({
                    name: file.name,
                    size: file.size,
                    ...(file.type ? { type: file.type } : {})
                }))
            });
            let uploadedBytes = 0;

            await Promise.all(session.uploadSession.files.map(async (sessionFile) => {
                const sourceFile = files[sessionFile.index]?.file;
                if (!sourceFile) {
                    throw new Error(`Missing local file for upload index ${sessionFile.index}`);
                }

                await uploadClusterObjectParts({
                    file: sourceFile,
                    parts: sessionFile.parts,
                    onProgress: (delta) => {
                        uploadedBytes = Math.min(totalBytes, uploadedBytes + delta);
                        updateUploadProgress(uploadId, totalBytes > 0 ? uploadedBytes / totalBytes : 1);
                    }
                });
            }));

            await trajectoryService.commitUploadSession({
                uploadSessionId: session.uploadSession.id
            });
            updateUploadProgress(uploadId, 1);
            sileo.success({ title: UPLOAD_SUCCESS_TITLE });
        } catch (error) {
            if (session) {
                await trajectoryService.cancelUploadSession({
                    uploadSessionId: session.uploadSession.id
                }).catch(() => undefined);
            }

            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: UPLOAD_ERROR_TITLE,
                fallbackDescription: UPLOAD_ERROR_DESCRIPTION
            });
        } finally {
            removeUpload(uploadId);
            activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
            setIsUploading(activeUploadsRef.current > 0);
        }
    }, [addUpload, createTrajectory, folderId, removeUpload, updateUploadProgress]);

    return { uploadTrajectory, isUploading };
}
