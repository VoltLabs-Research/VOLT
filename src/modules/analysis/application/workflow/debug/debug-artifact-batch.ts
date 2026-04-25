import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    ArtifactStageInput,
    ArtifactStageBufferInput,
    ArtifactStageFileInput,
    ArtifactUploadBatchEnqueueResult
} from '@/modules/plugin/contracts/artifact-upload';
import { sanitizeFileName } from '@/support/fs/sanitize-file-name';
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

export const createDebugArtifactBatch = (baseDirectory: string): DebugArtifactBatch => {
    const artifacts: DebugArtifactRecord[] = [];
    let sequence = 0;

    const createStagedPath = (fileName: string): string => {
        const stagedPath = path.join(baseDirectory, `${`${sequence}`.padStart(4, '0')}-${fileName}`);
        sequence += 1;
        return stagedPath;
    };

    const stageArtifact = async (
        input: ArtifactStageInput,
        writer: (stagedPath: string) => Promise<void>
    ): Promise<void> => {
        await fs.mkdir(baseDirectory, { recursive: true });
        const fileName = sanitizeFileName(input.fileName ?? path.basename(input.objectKey));
        const stagedPath = createStagedPath(fileName);
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
        async stageFileUpload(input: ArtifactStageFileInput): Promise<void> {
            await stageArtifact(input, (stagedPath) => fs.copyFile(input.sourcePath, stagedPath));
        },

        async stageBufferUpload(input: ArtifactStageBufferInput): Promise<void> {
            await stageArtifact(input, (stagedPath) => fs.writeFile(stagedPath, input.buffer));
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
