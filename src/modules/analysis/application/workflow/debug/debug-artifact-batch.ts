import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    ArtifactStageBufferInput,
    ArtifactStageFileInput,
    ArtifactUploadBatchEnqueueResult
} from '@/modules/plugin/contracts/artifact-upload';
import { safeRemovePath } from '@/support/fs/safe-remove-path';

interface DebugArtifactRecord {
    path: string;
    bucket: string;
    objectKey: string;
    contentType?: string;
    fileName: string;
}

export interface DebugArtifactBatch {
    stageFileUpload(input: ArtifactStageFileInput): Promise<void>;
    stageBufferUpload(input: ArtifactStageBufferInput): Promise<void>;
    enqueue(): Promise<ArtifactUploadBatchEnqueueResult>;
    cleanup(): Promise<void>;
    getArtifacts(): DebugArtifactRecord[];
}

const normalizeFileName = (fileName: string): string => {
    const normalized = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-');
    return normalized.length > 0 ? normalized : 'artifact';
};

export const createDebugArtifactBatch = (baseDirectory: string): DebugArtifactBatch => {
    const artifacts: DebugArtifactRecord[] = [];
    let sequence = 0;

    const createStagedPath = (fileName: string): string => {
        const stagedPath = path.join(baseDirectory, `${`${sequence}`.padStart(4, '0')}-${fileName}`);
        sequence += 1;
        return stagedPath;
    };

    return {
        async stageFileUpload(input: ArtifactStageFileInput): Promise<void> {
            await fs.mkdir(baseDirectory, { recursive: true });
            const sourceFileName = input.fileName ?? path.basename(input.objectKey);
            const fileName = normalizeFileName(sourceFileName);
            const stagedPath = createStagedPath(fileName);
            await fs.copyFile(input.sourcePath, stagedPath);
            artifacts.push({
                path: stagedPath,
                bucket: input.bucket,
                objectKey: input.objectKey,
                contentType: input.contentType,
                fileName
            });
        },

        async stageBufferUpload(input: ArtifactStageBufferInput): Promise<void> {
            await fs.mkdir(baseDirectory, { recursive: true });
            const sourceFileName = input.fileName ?? path.basename(input.objectKey);
            const fileName = normalizeFileName(sourceFileName);
            const stagedPath = createStagedPath(fileName);
            await fs.writeFile(stagedPath, input.buffer);
            artifacts.push({
                path: stagedPath,
                bucket: input.bucket,
                objectKey: input.objectKey,
                contentType: input.contentType,
                fileName
            });
        },

        enqueue(): Promise<ArtifactUploadBatchEnqueueResult> {
            return Promise.resolve({
                queuedUploads: artifacts.length
            });
        },

        async cleanup(): Promise<void> {
            await safeRemovePath(baseDirectory, { recursive: true });
        },

        getArtifacts(): DebugArtifactRecord[] {
            return [...artifacts];
        }
    };
};
