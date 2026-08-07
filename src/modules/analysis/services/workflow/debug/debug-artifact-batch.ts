import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    ArtifactStageInput,
    ArtifactStageBufferInput,
    ArtifactUploadBatchEnqueueResult
} from '@shared/contracts/types/artifact-upload';
import { sanitizeFileName } from '@shared/infrastructure/utilities/sanitize-file-name';
import { safeRemovePath } from '@shared/infrastructure/utilities/safe-remove-path';

interface DebugArtifactRecord {
    path: string;
    bucket: string;
    objectKey: string;
    contentType?: string;
    fileName: string;
}

export interface DebugArtifactBatch {
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
