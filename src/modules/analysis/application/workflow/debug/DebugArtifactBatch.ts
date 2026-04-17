import fs from 'node:fs/promises';
import path from 'node:path';

interface DebugArtifactRecord {
    path: string;
    bucket: string;
    objectKey: string;
    contentType?: string;
    fileName: string;
}

interface DebugArtifactStageInputBase {
    bucket: string;
    objectKey: string;
    contentType?: string;
    fileName?: string;
}

interface DebugArtifactStageFileInput extends DebugArtifactStageInputBase {
    sourcePath: string;
}

interface DebugArtifactStageBufferInput extends DebugArtifactStageInputBase {
    buffer: Buffer;
}

interface DebugArtifactBatchEnqueueResult {
    queuedUploads: number;
}

export interface DebugArtifactBatch {
    stageFileUpload(input: DebugArtifactStageFileInput): Promise<void>;
    stageBufferUpload(input: DebugArtifactStageBufferInput): Promise<void>;
    enqueue(): Promise<DebugArtifactBatchEnqueueResult>;
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
        async stageFileUpload(input: DebugArtifactStageFileInput): Promise<void> {
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

        async stageBufferUpload(input: DebugArtifactStageBufferInput): Promise<void> {
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

        enqueue(): Promise<DebugArtifactBatchEnqueueResult> {
            return Promise.resolve({
                queuedUploads: artifacts.length
            });
        },

        async cleanup(): Promise<void> {
            await fs.rm(baseDirectory, { recursive: true, force: true }).catch(() => {});
        },

        getArtifacts(): DebugArtifactRecord[] {
            return [...artifacts];
        }
    };
};
