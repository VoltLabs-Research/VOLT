import { getKeyValueStore } from '@shared/infrastructure/keyvalue/KeyValueStore';
import type { Plugin } from '@modules/plugin/contracts/plugin';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import logger from '@shared/infrastructure/logger';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const gzipAsync = promisify(zlib.gzip);

const CACHE_TTL_MS = 600_000;
const CACHE_PREFIX = 'plugin-dispatch:v2:';

interface NestedPluginDefinition {
    pluginId: string;
    workflow: WorkflowProps;
}

const injectOwnerClusterIdIntoWorkflow = (
    workflow: WorkflowProps,
    ownerClusterId: string
): WorkflowProps => {
    if (!ownerClusterId) {
        return workflow;
    }

    return {
        ...workflow,
        nodes: workflow.nodes.map((node) => {
            if (node.type !== WorkflowNodeType.Entrypoint || !node.data.entrypoint) {
                return node;
            }

            return {
                ...node,
                data: {
                    ...node.data,
                    entrypoint: {
                        ...node.data.entrypoint,
                        ownerClusterId
                    }
                }
            };
        })
    };
};

class PluginDispatchEncoder {
    private readonly inflightEncodes = new Map<string, Promise<string>>();

    async encode(value: unknown): Promise<string> {
        const compressed = await gzipAsync(Buffer.from(JSON.stringify(value), 'utf8'));
        return compressed.toString('base64');
    }

    encodeWorkflow(plugin: Plugin, ownerClusterId: string): Promise<string> {
        const revision = plugin.props.updatedAt.getTime();
        const cacheKey = `${CACHE_PREFIX}workflow:${plugin.id}:${revision}:${ownerClusterId || 'unknown-owner'}`;

        return this.cachedEncode(
            cacheKey,
            injectOwnerClusterIdIntoWorkflow(plugin.props.workflow.props, ownerClusterId)
        );
    }

    encodeNestedPlugins(
        rootPluginId: string,
        dependencies: Plugin[],
        ownerClusterIds: Map<string, string>
    ): Promise<string> {
        const revisionToken = dependencies
            .map((dependency) => `${dependency.id}@${dependency.props.updatedAt.getTime()}@${ownerClusterIds.get(dependency.id) || 'unknown-owner'}`)
            .sort()
            .join('|');
        const nestedPlugins: NestedPluginDefinition[] = dependencies.map((dependency) => ({
            pluginId: dependency.id,
            workflow: injectOwnerClusterIdIntoWorkflow(
                dependency.props.workflow.props,
                ownerClusterIds.get(dependency.id) ?? ''
            )
        }));

        return this.cachedEncode(`${CACHE_PREFIX}nested:${rootPluginId}:${revisionToken || 'empty'}`, nestedPlugins);
    }

    private async cachedEncode(cacheKey: string, value: unknown): Promise<string> {
        try {
            const cached = await getKeyValueStore().get(cacheKey);
            if (cached) {
                return cached;
            }
        } catch (error: unknown) {
            logger.warn({
                err: error,
                cacheKey
            }, '@plugin-execution-router: dispatch section cache read failed');
        }

        const existing = this.inflightEncodes.get(cacheKey);
        if (existing) return existing;

        const pending = (async () => {
            const encoded = await this.encode(value);
            try {
                await getKeyValueStore().set(cacheKey, encoded, { ttlMs: CACHE_TTL_MS });
            } catch (error: unknown) {
                logger.warn({
                    err: error,
                    cacheKey
                }, '@plugin-execution-router: dispatch section cache write failed');
            }
            return encoded;
        })().finally(() => {
            this.inflightEncodes.delete(cacheKey);
        });

        this.inflightEncodes.set(cacheKey, pending);
        return pending;
    }
}

export default new PluginDispatchEncoder();
