import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import type { PluginBinaryCache } from '@/modules/plugin/application/binaries/PluginBinaryCache';
import {
    WasmPluginInstance,
    type WasmFrameChunk,
    type WasmProcessInput,
    type WasmProcessResult
} from '@/modules/plugin/application/runtime/WasmPluginInstance';

const MODULE_CACHE_MAX_ENTRIES = 32;
const MODULE_CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedModule {
    compiled: WebAssembly.Module;
    hash: string;
    loadedAt: number;
    lastUsedAt: number;
    sourcePath: string;
}

export interface WasmExecutionInput {
    binaryObjectPath: string;
    ownerClusterId?: string;
    pluginId: string;
    frame: WasmFrameChunk;
    config?: unknown;
    timeoutMs?: number;
    logSink?: WasmProcessInput['logSink'];
}

let sharedWasmRuntime: WasmRuntime | null = null;

export const getSharedWasmRuntime = (): WasmRuntime | null => sharedWasmRuntime;

@Service('wasmRuntime')
export class WasmRuntime {
    private readonly modules = new Map<string, CachedModule>();

    public constructor(private readonly pluginBinaryCache: PluginBinaryCache) {
        sharedWasmRuntime = this;
    }

    public async execute(input: WasmExecutionInput): Promise<WasmProcessResult> {
        const module = await this.resolveModule(input.binaryObjectPath, input.ownerClusterId);
        const instance = new WasmPluginInstance(module.compiled);
        const timeoutMs = input.timeoutMs ?? 30_000;

        try {
            const result = await instance.process({
                frame: input.frame,
                config: input.config,
                pluginId: input.pluginId,
                timeoutMs,
                logSink: input.logSink
            });
            return result;
        } catch (error: unknown) {
            logger.warn(
                { err: error, pluginId: input.pluginId, binaryObjectPath: input.binaryObjectPath },
                '@wasm-runtime: execution failed'
            );
            throw error;
        }
    }

    private async resolveModule(binaryObjectPath: string, ownerClusterId?: string): Promise<CachedModule> {
        const runtime = await this.pluginBinaryCache.getExecutionRuntime({
            binaryObjectPath,
            ownerClusterId
        });
        const artifactPath = runtime.artifactPath;
        const bytes = await fs.readFile(artifactPath);
        const hash = createHash('sha256').update(bytes).digest('hex');
        const cacheKey = `${artifactPath}::${hash}`;

        const existing = this.modules.get(cacheKey);
        if (existing) {
            existing.lastUsedAt = Date.now();
            this.modules.delete(cacheKey);
            this.modules.set(cacheKey, existing);
            return existing;
        }

        if (!WebAssembly.validate(bytes)) {
            throw new Error(`wasm runtime: invalid module at ${artifactPath}`);
        }

        const compiled = await WebAssembly.compile(bytes);
        const entry: CachedModule = {
            compiled,
            hash,
            loadedAt: Date.now(),
            lastUsedAt: Date.now(),
            sourcePath: artifactPath
        };
        this.modules.set(cacheKey, entry);
        this.evictStale();
        return entry;
    }

    private evictStale(): void {
        const now = Date.now();
        for (const [key, entry] of this.modules) {
            if (now - entry.lastUsedAt > MODULE_CACHE_TTL_MS) {
                this.modules.delete(key);
            }
        }
        while (this.modules.size > MODULE_CACHE_MAX_ENTRIES) {
            const oldestKey = this.modules.keys().next().value;
            if (!oldestKey) break;
            this.modules.delete(oldestKey);
        }
    }
}
