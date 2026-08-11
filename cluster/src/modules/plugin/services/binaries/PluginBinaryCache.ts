import { createHash } from 'node:crypto';
import { singleton } from '@shared/application/utilities/singleton';
import type {
    PluginExecutionRuntime,
    PluginExecutionRuntimeInput
} from '@shared/contracts/types/plugin-execution';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import type { DaemonConfig } from '@core/config/daemon';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { EntrypointType } from '@shared/contracts/types/http-runtime';
import {
    PluginArtifactDownloader,
    type PluginArtifactSource
} from '@modules/plugin/services/binaries/PluginArtifactDownloader';
import {
    PluginWarmImageStore,
    type PluginWarmupImageDescriptor
} from '@modules/plugin/services/binaries/PluginWarmImageStore';
import { buildRuntimeCacheKey } from '@modules/plugin/services/binaries/runtime-cache-keys';
import { providePythonRuntime } from '@modules/plugin/services/binaries/python-runtime-provisioner';
import { providePackagedRuntime } from '@modules/plugin/services/binaries/packaged-runtime-provisioner';

/** Resolves the runtime a plugin executes with, provisioning it once per artifact revision. */

export class PluginBinaryCache {
    private readonly artifacts: PluginArtifactDownloader;
    private readonly warmImages: PluginWarmImageStore;
    private readonly pythonRuntimePromises = new Map<string, Promise<PluginExecutionRuntime>>();
    private readonly packagedRuntimePromises = new Map<string, Promise<PluginExecutionRuntime>>();

    constructor(objectStore: ClusterObjectStore, config: DaemonConfig) {
        this.artifacts = new PluginArtifactDownloader(objectStore, config.teamClusterId);
        this.warmImages = new PluginWarmImageStore(objectStore, config.teamClusterId);
    }

    async getExecutionRuntime(input: PluginExecutionRuntimeInput): Promise<PluginExecutionRuntime> {
        const entrypointType = input.entrypointType ?? EntrypointType.Executable;
        if (entrypointType === EntrypointType.PythonScript) {
            return this.getPythonRuntime(
                input.binaryObjectPath,
                input.ownerClusterId,
                input.requirementsFile ?? '',
                input.entrypointScript
            );
        }
        if (entrypointType === EntrypointType.PackagedExecutable) {
            // Declared by the plugin manifest, so it may legitimately be missing.
            if (!input.entrypointScript) {
                throw new Error('Packaged executable entrypointScript is required');
            }

            return this.getPackagedRuntime(input.binaryObjectPath, input.ownerClusterId, input.entrypointScript);
        }

        const source = await this.artifacts.resolveSource(input.binaryObjectPath, input.ownerClusterId);
        const artifactPath = await this.artifacts.getLocalPath(input.binaryObjectPath, source);
        return {
            artifactPath,
            commandPath: artifactPath,
            argsPrefix: [],
            binaryHash: source.expectedHash
        };
    }

    async warmUpPlugin(input: {
        pluginId: string;
        binaryObjectPath: string;
        ownerClusterId?: string;
        requirementsFile: string;
        entrypointScript?: string;
    }): Promise<PluginWarmupImageDescriptor> {
        const runtime = await this.getPythonRuntime(
            input.binaryObjectPath,
            input.ownerClusterId,
            input.requirementsFile,
            input.entrypointScript
        );
        const source = await this.artifacts.resolveSource(input.binaryObjectPath, input.ownerClusterId);
        const binaryHash = source.expectedHash ?? createHash('sha256').update(runtime.artifactPath).digest('hex');

        return this.warmImages.publish({
            pluginId: input.pluginId,
            binaryHash,
            runtimeKey: buildRuntimeCacheKey(
                input.binaryObjectPath,
                source.ownerClusterId,
                binaryHash,
                input.requirementsFile
            ),
            requirements: input.requirementsFile,
            entrypointScript: input.entrypointScript
        });
    }

    private async getPythonRuntime(
        binaryObjectPath: string,
        ownerClusterId: string | undefined,
        requirementsFile: string,
        entrypointScript?: string
    ): Promise<PluginExecutionRuntime> {
        const source = await this.artifacts.resolveSource(binaryObjectPath, ownerClusterId);
        const artifactPath = await this.artifacts.getLocalPath(binaryObjectPath, source);
        const runtimeKey = buildRuntimeCacheKey(
            binaryObjectPath,
            source.ownerClusterId,
            source.expectedHash,
            requirementsFile
        );

        return this.provisionOnce(this.pythonRuntimePromises, runtimeKey, async () => {
            await this.prefetchWarmImage(binaryObjectPath, source);
            const provisioned = await providePythonRuntime({
                runtimeKey,
                artifactPath,
                artifactRevision: source.expectedHash || artifactPath,
                requirementsFile,
                entrypointScript
            });

            return {
                ...provisioned,
                artifactPath,
                binaryHash: source.expectedHash
            };
        });
    }

    private async getPackagedRuntime(
        binaryObjectPath: string,
        ownerClusterId: string | undefined,
        entrypointScript: string
    ): Promise<PluginExecutionRuntime> {
        const source = await this.artifacts.resolveSource(binaryObjectPath, ownerClusterId);
        const artifactPath = await this.artifacts.getLocalPath(binaryObjectPath, source);
        const runtimeKey = buildRuntimeCacheKey(
            binaryObjectPath,
            source.ownerClusterId,
            source.expectedHash,
            entrypointScript
        );

        return this.provisionOnce(this.packagedRuntimePromises, runtimeKey, async () => {
            const provisioned = await providePackagedRuntime({
                runtimeKey,
                artifactPath,
                artifactRevision: source.expectedHash || artifactPath,
                entrypointScript
            });

            return {
                ...provisioned,
                artifactPath,
                binaryHash: source.expectedHash
            };
        });
    }

    /** Warm images are addressed without a requirements variant. */
    private async prefetchWarmImage(binaryObjectPath: string, source: PluginArtifactSource): Promise<void> {
        if (!source.expectedHash) return;

        await this.warmImages.restore({
            binaryObjectPath,
            binaryHash: source.expectedHash,
            runtimeKey: buildRuntimeCacheKey(binaryObjectPath, source.ownerClusterId, source.expectedHash, '')
        }).catch((error: unknown) => {
            logger.warn({
                err: error,
                binaryObjectPath
            }, '@plugin-binary-cache: warm prefetch failed');
        });
    }

    private provisionOnce(
        runtimePromises: Map<string, Promise<PluginExecutionRuntime>>,
        runtimeKey: string,
        provision: () => Promise<PluginExecutionRuntime>
    ): Promise<PluginExecutionRuntime> {
        const existingPromise = runtimePromises.get(runtimeKey);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = provision().finally(() => {
            runtimePromises.delete(runtimeKey);
        });

        runtimePromises.set(runtimeKey, nextPromise);
        return nextPromise;
    }
}

export const getPluginBinaryCache = singleton((): PluginBinaryCache => new PluginBinaryCache(getObjectStore(), getConfig()));
