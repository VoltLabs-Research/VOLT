import { injectable, inject } from 'tsyringe';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { decodeMultiStream } from '@shared/infrastructure/utilities/msgpack';
import { SYS_BUCKETS } from '@core/config/minio';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';
import nativeStats from '@modules/trajectory/infrastructure/native/NativeStats';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/TrajectoryParserFactory';
import logger from '@shared/infrastructure/logger';
import {
    IAtomPropertiesService,
    FilterExpression,
    FilterResult,
    ExposureAtomConfig
} from '@modules/trajectory/domain/port/IAtomPropertiesService';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import Plugin from '@modules/plugin/domain/entities/Plugin';
import Analysis from '@modules/analysis/domain/entities/Analysis';

@injectable()
export default class AtomPropertiesService implements IAtomPropertiesService {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService
    ) { }

    async getModifierPerAtomProps(analysisId: string): Promise<Record<string, string[]>> {
        const { plugin } = await this.getAnalysisAndPlugin(analysisId);
        const workflow = plugin.props.workflow;
        const props: Record<string, string[]> = {};
        const visualizerNodes = workflow.props.nodes.filter((node: any) => node.type === WorkflowNodeType.Visualizers);

        logger.debug(`[AtomPropertiesService.getModifierPerAtomProps] Found ${visualizerNodes.length} visualizer nodes`);

        for (const visualizerNode of visualizerNodes) {
            const perAtom = visualizerNode?.data?.visualizers?.perAtomProperties;
            logger.debug(`[AtomPropertiesService.getModifierPerAtomProps] Visualizer ${visualizerNode.id} perAtomProperties: ${JSON.stringify(perAtom)}`);

            if (!Array.isArray(perAtom) || perAtom.length === 0) continue;

            const exposureNode = workflow.findAncestorByType(visualizerNode.id, WorkflowNodeType.Exposure);
            logger.debug(`[AtomPropertiesService.getModifierPerAtomProps] Found ancestor exposure for visualizer ${visualizerNode.id}: ${exposureNode?.id || 'none'}`);

            if (exposureNode?.id) {
                props[String(exposureNode.id)] = perAtom;
            }
        }

        logger.debug(`[AtomPropertiesService.getModifierPerAtomProps] Final props: ${JSON.stringify(props)}`);
        return props;
    }

    async getExposureAtomConfig(analysisId: string, exposureId: string): Promise<ExposureAtomConfig> {
        const { plugin } = await this.getAnalysisAndPlugin(analysisId);
        const workflow = plugin.props.workflow;
        const exposureNode = workflow.props.nodes
            .filter((node: any) => node.type === WorkflowNodeType.Exposure)
            .find((node: any) => String(node.id) === String(exposureId));

        if (!exposureNode) throw new RuntimeError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404);

        const schemaNode = workflow.findDescendantByType(String(exposureId), WorkflowNodeType.Schema);
        const visualizerNode = workflow.findDescendantByType(String(exposureId), WorkflowNodeType.Visualizers);

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

    async getModifierAnalysis(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string
    ): Promise<any> {
        const config = await this.getExposureAtomConfig(analysisId, exposureId);
        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, timestep);

        const stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, key);

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

    async buildPluginIndexForAtomIds(
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
        const pluginStream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, key);

        const pluginIndex = new Map<number, any>();
        const stream = pluginStream as unknown as AsyncIterable<Uint8Array>;

        for await (const msg of decodeMultiStream(stream)) {
            let pluginData: any = msg;

            if (config.iterableKey && pluginData?.[config.iterableKey]) {
                pluginData = pluginData[config.iterableKey];
            }

            if (!Array.isArray(pluginData)) continue;

            let shouldBreak = false;
            for (const item of pluginData) {
                if (shouldBreak) break;

                const id = item?.id;
                if (id === undefined) continue;
                if (!targetIds.has(id)) continue;

                pluginIndex.set(id, item);

                if (pluginIndex.size >= targetIds.size) {
                    shouldBreak = true;
                }
            }

            if (shouldBreak) {
                if (typeof (pluginStream as any).destroy === 'function') {
                    (pluginStream as any).destroy();
                }
                return pluginIndex;
            }
        }

        return pluginIndex.size > 0 ? pluginIndex : null;
    }

    toFloat32ByAtomId(data: any, property: string): Float32Array | undefined {
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

    getMinMaxFromData(data: any, property: string): { min: number; max: number } | undefined {
        if (data && (data[property] instanceof Float32Array || data[property] instanceof Float64Array)) {
            const arr = data[property] instanceof Float32Array ? data[property] : new Float32Array(data[property]);
            const r = nativeStats.getMinMaxFromTypedArray(arr);
            return r || undefined;
        }

        if (data && Array.isArray(data[property])) {
            const arr = new Float32Array(data[property]);
            const r = nativeStats.getMinMaxFromTypedArray(arr);
            return r || undefined;
        }

        if (Array.isArray(data)) {
            const arr = this.toFloat32ByAtomId(data, property);
            if (!arr) return undefined;

            const r = nativeStats.getMinMaxFromTypedArray(arr);
            return r || undefined;
        }

        return undefined;
    }

    evaluateFilter(values: Float32Array, operator: string, compareValue: number): FilterResult {
        const mask = new Uint8Array(values.length);
        let matchCount = 0;
        const val = compareValue;

        switch (operator) {
            case '==':
                for (let i = 0; i < values.length; i++) {
                    if (values[i] === val) { mask[i] = 1; matchCount++; }
                }
                break;
            case '!=':
                for (let i = 0; i < values.length; i++) {
                    if (values[i] !== val) { mask[i] = 1; matchCount++; }
                }
                break;
            case '>':
                for (let i = 0; i < values.length; i++) {
                    if (values[i] > val) { mask[i] = 1; matchCount++; }
                }
                break;
            case '>=':
                for (let i = 0; i < values.length; i++) {
                    if (values[i] >= val) { mask[i] = 1; matchCount++; }
                }
                break;
            case '<':
                for (let i = 0; i < values.length; i++) {
                    if (values[i] < val) { mask[i] = 1; matchCount++; }
                }
                break;
            case '<=':
                for (let i = 0; i < values.length; i++) {
                    if (values[i] <= val) { mask[i] = 1; matchCount++; }
                }
                break;
        }

        return { mask, matchCount };
    }

    filterByMask(positions: Float32Array, types: Uint16Array, mask: Uint8Array): {
        positions: Float32Array;
        types: Uint16Array;
        count: number;
    } {
        let count = 0;
        for (let i = 0; i < mask.length; i++) {
            if (mask[i]) count++;
        }

        const newPos = new Float32Array(count * 3);
        const newTypes = new Uint16Array(count);

        let idx = 0;
        for (let i = 0; i < mask.length; i++) {
            if (mask[i]) {
                const p3 = i * 3;
                const n3 = idx * 3;
                newPos[n3] = positions[p3];
                newPos[n3 + 1] = positions[p3 + 1];
                newPos[n3 + 2] = positions[p3 + 2];
                newTypes[idx] = types[i];
                idx++;
            }
        }

        return { positions: newPos, types: newTypes, count };
    }

    async evaluateFilterExpression(
        trajectoryId: string,
        analysisId: string | undefined,
        exposureId: string | null | undefined,
        timestep: string,
        expression: FilterExpression
    ): Promise<FilterResult> {
        let isPerAtomProperty = false;
        if (analysisId && exposureId) {
            try {
                const config = await this.getExposureAtomConfig(analysisId, exposureId);
                isPerAtomProperty = config.perAtomProperties.includes(expression.property);
            } catch {
                isPerAtomProperty = false;
            }
        }

        let values: Float32Array;

        if (isPerAtomProperty && exposureId && analysisId) {
            const modifierData = await this.getModifierAnalysis(trajectoryId, analysisId, exposureId, timestep);
            const idMap = this.toFloat32ByAtomId(modifierData, expression.property);

            const dumpFilePath = await this.dumpStorage.getDump(trajectoryId, timestep);
            if (!dumpFilePath) throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);

            const parsed = await TrajectoryParserFactory.parse(dumpFilePath, { includeIds: true, properties: [] });

            if (!parsed.ids) {
                values = new Float32Array(parsed.positions.length / 3);
            } else {
                values = new Float32Array(parsed.ids.length);
                if (idMap) {
                    for (let i = 0; i < parsed.ids.length; i++) {
                        const atomId = parsed.ids[i];
                        values[i] = idMap[atomId] || 0;
                    }
                }
            }
        } else {
            const dumpFilePath = await this.dumpStorage.getDump(trajectoryId, timestep);
            if (!dumpFilePath) throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);

            const lowerProp = expression.property.toLowerCase();
            const isStandard = ['type', 'id', 'x', 'y', 'z'].includes(lowerProp);
            let parsed;

            if (isStandard) {
                parsed = await TrajectoryParserFactory.parse(dumpFilePath, {
                    includeIds: lowerProp === 'id',
                    properties: []
                });
            } else {
                parsed = await TrajectoryParserFactory.parse(dumpFilePath, { properties: [expression.property] });
            }

            if (lowerProp === 'type') {
                values = new Float32Array(parsed.types.length);
                for (let i = 0; i < parsed.types.length; i++) {
                    values[i] = parsed.types[i];
                }
            } else if (lowerProp === 'x') {
                values = new Float32Array(parsed.positions.length / 3);
                for (let i = 0; i < values.length; i++) {
                    values[i] = parsed.positions[i * 3];
                }
            } else if (lowerProp === 'y') {
                values = new Float32Array(parsed.positions.length / 3);
                for (let i = 0; i < values.length; i++) {
                    values[i] = parsed.positions[i * 3 + 1];
                }
            } else if (lowerProp === 'z') {
                values = new Float32Array(parsed.positions.length / 3);
                for (let i = 0; i < values.length; i++) {
                    values[i] = parsed.positions[i * 3 + 2];
                }
            } else if (lowerProp === 'id' && parsed.ids) {
                values = new Float32Array(parsed.ids.length);
                for (let i = 0; i < parsed.ids.length; i++) {
                    values[i] = parsed.ids[i];
                }
            } else {
                values = parsed.properties?.[expression.property] || parsed.properties?.[lowerProp] || new Float32Array(0);
            }
        }

        return this.evaluateFilter(values, expression.operator, expression.value);
    }

    private getPluginMsgpackKey(trajectoryId: string, analysisId: string, exposureId: string, timestep: string): string {
        return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
    }

    private async getAnalysisAndPlugin(analysisId: string): Promise<{ analysis: Analysis; plugin: Plugin }> {
        const analysis = await this.analysisRepository.findById(analysisId);
        if (!analysis) throw new RuntimeError(ErrorCodes.ANALYSIS_NOT_FOUND, 404);

        const plugin = await this.pluginRepository.findOne({ slug: analysis.props.plugin });
        if (!plugin) throw new RuntimeError(ErrorCodes.PLUGIN_NOT_FOUND, 404);

        return { analysis, plugin };
    }
}
