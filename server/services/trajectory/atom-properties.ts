import { Analysis, Plugin } from '@/models';
import { SYS_BUCKETS } from '@/config/minio';
import { decodeMultiStream } from '@/utilities/msgpack/msgpack-stream';
import storage from '@/services/storage';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

import { NodeType } from '@/types/models/modifier';
import { findAncestorByType, findDescendantByType } from '@/utilities/plugins/workflow-utils';
import { getMinMaxNative } from '@/parsers/lammps/native-stats';

type AnyPlugin = any;

export interface ExposureAtomConfig {
    exposureId: string;
    iterableKey?: string;
    perAtomProperties: string[];
    schemaKeysMap: Map<string, string[]>;
}

export default class AtomProperties {
    public async getModifierPerAtomProps(analysisId: string): Promise<Record<string, string[]>> {
        const { plugin } = await this.getAnalysisAndPlugin(analysisId);

        const props: Record<string, string[]> = {};
        const visualizerNodes = plugin.workflow.nodes.filter((node: any) => node.type === NodeType.VISUALIZERS);

        for (const visualizerNode of visualizerNodes) {
            const perAtom = visualizerNode?.data?.visualizers?.perAtomProperties;
            if (!Array.isArray(perAtom) || perAtom.length === 0) continue;

            const exposureNode = findAncestorByType(visualizerNode.id, plugin.workflow, NodeType.EXPOSURE as any);
            if (exposureNode?.id) {
                props[String(exposureNode.id)] = perAtom;
            }
        }

        return props;
    }

    public async getExposureAtomConfig(analysisId: string, exposureId: string): Promise<ExposureAtomConfig> {
        const { plugin } = await this.getAnalysisAndPlugin(analysisId);

        const exposureNode = plugin.workflow.nodes.find(
            (node: any) => node.type === NodeType.EXPOSURE && String(node.id) === String(exposureId)
        );
        if (!exposureNode) throw new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404);

        const schemaNode = findDescendantByType(String(exposureId), plugin.workflow, NodeType.SCHEMA as any);
        const visualizerNode = findDescendantByType(String(exposureId), plugin.workflow, NodeType.VISUALIZERS as any);

        if (!schemaNode) throw new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404);

        const iterableKey: string | undefined = exposureNode?.data?.exposure?.iterable;
        const perAtomProperties: string[] = visualizerNode?.data?.visualizers?.perAtomProperties || [];

        const schemaDefinition = schemaNode?.data?.schema?.definition?.data?.items;
        const schemaKeysMap = new Map<string, string[]>();

        if (schemaDefinition && perAtomProperties.length > 0) {
            for (const prop of perAtomProperties) {
                const def = schemaDefinition[prop];
                if (def?.keys && Array.isArray(def.keys)) {
                    schemaKeysMap.set(prop, def.keys);
                }
            }
        }

        return {
            exposureId: String(exposureId),
            iterableKey,
            perAtomProperties,
            schemaKeysMap
        };
    }

    public async getModifierAnalysis(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string
    ): Promise<any> {
        const config = await this.getExposureAtomConfig(analysisId, exposureId);
        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, timestep);

        const stream = await storage.getStream(SYS_BUCKETS.PLUGINS, key);

        let data: any = null;

        const mergeChunkedValue = (target: any, incoming: any): any => {
            if (incoming === undefined || incoming === null) return target;
            if (target === undefined || target === null) return incoming;

            if (Array.isArray(target) && Array.isArray(incoming)) {
                target.push(...incoming);
                return target;
            }

            if (target && incoming && typeof target === 'object' && typeof incoming === 'object') {
                for (const [k, v] of Object.entries(incoming)) {
                    const existing = (target as any)[k];

                    if (Array.isArray(existing) && Array.isArray(v)) {
                        existing.push(...v);
                        continue;
                    }

                    if (existing && v && typeof existing === 'object' && typeof v === 'object') {
                        (target as any)[k] = mergeChunkedValue(existing, v);
                        continue;
                    }

                    (target as any)[k] = v;
                }
                return target;
            }

            return incoming;
        };

        for await (const msg of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
            let chunk: any = msg;
            if (config.iterableKey && chunk?.[config.iterableKey] !== undefined) {
                chunk = chunk[config.iterableKey];
            }
            data = mergeChunkedValue(data, chunk);
        }

        return data;
    }

    public async buildPluginIndexForAtomIds(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        targetIds: Set<number>
    ): Promise<Map<number, any> | null> {
        if (targetIds.size === 0) return null;

        const config = await this.getExposureAtomConfig(analysisId, exposureId);
        if (config.perAtomProperties.length === 0) return null;

        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, timestep);
        const pluginStream = await storage.getStream(SYS_BUCKETS.PLUGINS, key);

        const pluginIndex = new Map<number, any>();
        const stream = pluginStream as unknown as AsyncIterable<Uint8Array>;

        for await (const msg of decodeMultiStream(stream)) {
            let pluginData: any = msg;

            if (config.iterableKey && pluginData?.[config.iterableKey]) {
                pluginData = pluginData[config.iterableKey];
            }

            if (!Array.isArray(pluginData)) continue;

            for (const item of pluginData) {
                const id = item?.id;
                if (id === undefined) continue;
                if (!targetIds.has(id)) continue;

                pluginIndex.set(id, item);

                if (pluginIndex.size >= targetIds.size) {
                    if (typeof (pluginStream as any).destroy === 'function') {
                        (pluginStream as any).destroy();
                    }
                    return pluginIndex;
                }
            }
        }

        return pluginIndex.size > 0 ? pluginIndex : null;
    }

    public toFloat32ByAtomId(data: any, property: string): Float32Array | undefined {
        if (!data) return undefined;

        if (data[property] instanceof Float32Array) return data[property];
        if (data[property] instanceof Float64Array) return new Float32Array(data[property]);

        if (Array.isArray(data[property])) {
            return new Float32Array(data[property]);
        }

        if (!Array.isArray(data) || data.length === 0) return undefined;

        let maxId = 0;
        for (let i = 0; i < data.length; i++) {
            const id = data[i]?.id;
            if (typeof id === 'number' && id > maxId) maxId = id;
        }
        if (maxId <= 0) return undefined;

        const out = new Float32Array(maxId + 1);

        const first = data[0];
        const isVector = Array.isArray(first?.[property]);

        if (!isVector) {
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                const id = item?.id;
                if (typeof id !== 'number') continue;
                out[id] = Number(item?.[property]) || 0;
            }
            return out;
        }

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const id = item?.id;
            if (typeof id !== 'number') continue;

            const vec = item?.[property] as number[] | undefined;
            if (!Array.isArray(vec) || vec.length === 0) continue;

            let sum = 0;
            for (let k = 0; k < vec.length; k++) {
                const v = Number(vec[k]) || 0;
                sum += v * v;
            }
            out[id] = Math.sqrt(sum);
        }

        return out;
    }

    public getMinMaxFromData(data: any, property: string): { min: number; max: number } | undefined {
        if (data && (data[property] instanceof Float32Array || data[property] instanceof Float64Array)) {
            const arr = data[property] instanceof Float32Array ? data[property] : new Float32Array(data[property]);
            const r = getMinMaxNative(arr);
            return r || undefined;
        }

        // 2) data[property] array
        if (data && Array.isArray(data[property])) {
            const arr = new Float32Array(data[property]);
            const r = getMinMaxNative(arr);
            return r || undefined;
        }

        // 3) object array > float32
        if (Array.isArray(data)) {
            const arr = this.toFloat32ByAtomId(data, property);
            if (!arr) return undefined;

            const r = getMinMaxNative(arr);
            return r || undefined;
        }

        return undefined;
    }

    private getPluginMsgpackKey(trajectoryId: string, analysisId: string, exposureId: string, timestep: string): string {
        return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
    }

    private async getAnalysisAndPlugin(analysisId: string): Promise<{ analysis: any; plugin: AnyPlugin }> {
        const analysis = await Analysis.findById(analysisId).lean();
        if (!analysis) throw new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404);

        const plugin = await Plugin.findOne({ slug: analysis.plugin }).lean();
        if (!plugin) throw new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404);

        return { analysis, plugin };
    }
}
