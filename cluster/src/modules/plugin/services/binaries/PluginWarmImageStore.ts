import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createZstdCompress, createZstdDecompress } from 'node:zlib';
import * as tar from 'tar';
import { logger } from '@shared/infrastructure/logger';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { isObjectNotFoundError } from '@shared/contracts/types/cluster-object-store';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { runtimeDirectoryFor } from '@modules/plugin/services/binaries/runtime-cache-keys';
import {
    PYTHON_PROJECT_DIRECTORY,
    PYTHON_RUNTIME_WARM_ENTRIES,
    PYTHON_VENV_DIRECTORY
} from '@modules/plugin/services/binaries/python-runtime-provisioner';

/** Publishes and restores warm images: tarballs of a provisioned python runtime directory. */

const WARM_IMAGE_MARKER_FILENAME = '.warm-image-applied';
const WARM_IMAGE_OBJECT_KEY_PREFIX = 'plugins/warm/';
const WARM_IMAGE_EXTENSION = 'warm.tar.zst';
const WARM_IMAGE_METADATA_KEY = 'warm-image-descriptor';

export interface PluginWarmupImageDescriptor {
    pluginId: string;
    binaryHash: string;
    tarballObjectKey: string;
    createdAt: string;
    requirements: string;
    entrypointScript?: string;
    venvRelativePath: string;
    projectRelativePath: string;
}

const warmImageObjectKeyFor = (binaryHash: string): string =>
    `${WARM_IMAGE_OBJECT_KEY_PREFIX}${binaryHash}.${WARM_IMAGE_EXTENSION}`;

export class PluginWarmImageStore {
    public constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly teamClusterId: string
    ) {}

    public async publish(input: {
        pluginId: string;
        binaryHash: string;
        runtimeKey: string;
        requirements: string;
        entrypointScript?: string;
    }): Promise<PluginWarmupImageDescriptor> {
        const runtimeDirectory = runtimeDirectoryFor(input.runtimeKey);
        const warmObjectKey = warmImageObjectKeyFor(input.binaryHash);
        const descriptor: PluginWarmupImageDescriptor = {
            pluginId: input.pluginId,
            binaryHash: input.binaryHash,
            tarballObjectKey: warmObjectKey,
            createdAt: new Date().toISOString(),
            requirements: input.requirements,
            entrypointScript: input.entrypointScript,
            venvRelativePath: PYTHON_VENV_DIRECTORY,
            projectRelativePath: PYTHON_PROJECT_DIRECTORY
        };

        const presentEntries: string[] = [];
        for (const entry of PYTHON_RUNTIME_WARM_ENTRIES) {
            const exists = await fs.access(path.join(runtimeDirectory, entry)).then(() => true, () => false);
            if (exists) {
                presentEntries.push(entry);
            }
        }

        if (presentEntries.length === 0) {
            throw new Error(`Warm image has nothing to package for plugin ${input.pluginId}`);
        }

        await this.objectStore.putObject({
            ownerClusterId: this.teamClusterId,
            bucket: ObjectBucketName.Plugins,
            objectKey: warmObjectKey,
            body: await this.packRuntimeDirectory(runtimeDirectory, presentEntries),
            metadata: {
                'content-type': 'application/x-tar+zstd',
                [WARM_IMAGE_METADATA_KEY]: JSON.stringify(descriptor),
                'plugin-id': input.pluginId,
                'binary-hash': input.binaryHash
            }
        });

        await fs.writeFile(
            path.join(runtimeDirectory, WARM_IMAGE_MARKER_FILENAME),
            input.binaryHash,
            'utf-8'
        ).catch(() => {});
        return descriptor;
    }

    /** Returns false when no warm image exists yet, so provisioning can continue locally. */
    public async restore(input: {
        binaryObjectPath: string;
        binaryHash: string;
        runtimeKey: string;
    }): Promise<boolean> {
        const runtimeDirectory = runtimeDirectoryFor(input.runtimeKey);
        const appliedMarker = path.join(runtimeDirectory, WARM_IMAGE_MARKER_FILENAME);
        const existingMarker = await fs.readFile(appliedMarker, 'utf-8').catch(() => null);
        if (existingMarker === input.binaryHash) {
            return true;
        }

        const warmObjectKey = warmImageObjectKeyFor(input.binaryHash);
        try {
            const response = await this.objectStore.getStream(
                this.teamClusterId,
                ObjectBucketName.Plugins,
                warmObjectKey,
                { skipMetadata: true }
            );
            await fs.mkdir(runtimeDirectory, { recursive: true });
            await pipeline(
                response.stream,
                createZstdDecompress(),
                tar.x({ cwd: runtimeDirectory })
            );
            await fs.writeFile(appliedMarker, input.binaryHash, 'utf-8');
            logger.info({
                binaryObjectPath: input.binaryObjectPath,
                runtimeKey: input.runtimeKey
            }, '@plugin-binary-cache: warm image applied');
            return true;
        } catch (error: unknown) {
            if (isObjectNotFoundError(error)) {
                return false;
            }
            logger.warn({
                err: error,
                warmObjectKey
            }, '@plugin-binary-cache: warm image restore failed');
            return false;
        }
    }

    private async packRuntimeDirectory(runtimeDirectory: string, entries: string[]): Promise<Buffer> {
        const packStream = tar.c(
            {
                cwd: runtimeDirectory,
                gzip: false,
                portable: true
            },
            entries
        ) as Readable;

        const buffers: Buffer[] = [];
        for await (const chunk of packStream.pipe(createZstdCompress())) {
            buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer));
        }
        return Buffer.concat(buffers);
    }
}
