import type {
    ArtifactUploadBatch,
    ArtifactUploadBatchEnqueueResult,
    ArtifactUploadStageBufferInput,
    ArtifactUploadStageFileInput
} from '@/modules/artifacts/services/ArtifactUploadQueueService';
import fs from 'node:fs/promises';
import path from 'node:path';

interface DebugArtifactRecord {
    path: string;
    bucket: string;
    objectKey: string;
    contentType?: string;
    fileName: string;
}

export interface DebugArtifactBatch extends ArtifactUploadBatch {
    getArtifacts(): DebugArtifactRecord[];
}

const sanitizeFileName = (value: string): string => {
    const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
    return normalized.length > 0 ? normalized : 'artifact';
};

const resolveFileName = (
    input: Pick<ArtifactUploadStageFileInput, 'fileName' | 'objectKey'>
): string => {
    if (typeof input.fileName === 'string' && input.fileName.trim().length > 0) {
        return sanitizeFileName(input.fileName);
    }

    const objectBaseName = path.basename(input.objectKey);
    if (objectBaseName.length > 0) {
        return sanitizeFileName(objectBaseName);
    }

    return 'artifact';
};

export const createDebugArtifactBatch = (baseDirectory: string): DebugArtifactBatch => {
    const artifacts: DebugArtifactRecord[] = [];
    let sequence = 0;

    const stage = async (
        input: Pick<ArtifactUploadStageFileInput, 'bucket' | 'contentType' | 'fileName' | 'objectKey'>,
        writer: (targetPath: string) => Promise<void>
    ): Promise<void> => {
        await fs.mkdir(baseDirectory, { recursive: true });
        const fileName = resolveFileName(input);
        const stagedPath = path.join(baseDirectory, `${String(sequence).padStart(4, '0')}-${fileName}`);
        sequence += 1;
        await writer(stagedPath);
        artifacts.push({
            path: stagedPath,
            bucket: input.bucket,
            objectKey: input.objectKey,
            contentType: input.contentType,
            fileName
        });
    };

    return {
        async stageFileUpload(input: ArtifactUploadStageFileInput): Promise<void> {
            await stage(input, (targetPath) => fs.copyFile(input.sourcePath, targetPath));
        },

        async stageBufferUpload(input: ArtifactUploadStageBufferInput): Promise<void> {
            await stage(input, (targetPath) => fs.writeFile(targetPath, input.buffer));
        },

        async enqueue(): Promise<ArtifactUploadBatchEnqueueResult> {
            return {
                queuedUploads: artifacts.length
            };
        },

        async cleanup(): Promise<void> {
            await fs.rm(baseDirectory, { recursive: true, force: true }).catch(() => {});
        },

        getArtifacts(): DebugArtifactRecord[] {
            return [...artifacts];
        }
    };
};
