import { injectable, inject } from 'tsyringe';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { decodeMultiStream } from '@shared/infrastructure/utilities/msgpack';
import { SYS_BUCKETS } from '@core/config/minio';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import nativeStats from '@modules/trajectory/infrastructure/native/NativeStats';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/TrajectoryParserFactory';
import mergeChunkedValue from '@modules/plugin/infrastructure/utilities/merge-chunked-value';
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
        const { analysis, plugin } = await this.getAnalysisAndPlugin(analysisId);
        const workflow = plugin.props.workflow;
        const trajectoryId = analysis.props.trajectory;
        const props: Record<string, string[]> = {};

        const exposureNodes = workflow.props.nodes.filter(
            (node: Record<string, unknown>) => node.type === WorkflowNodeType.Exposure
        );

        for (const exposureNode of exposureNodes) {
            const propertyNames = await this.discoverPerAtomPropertyNames(
                trajectoryId,
                analysisId,
                String(exposureNode.id)
            );

            if (propertyNames.length > 0) {
                props[String(exposureNode.id)] = propertyNames;
            }
        }

        return props;
    }

    async getExposureAtomConfig(analysisId: string, exposureId: string): Promise<ExposureAtomConfig> {
        const { analysis, plugin } = await this.getAnalysisAndPlugin(analysisId);
        const workflow = plugin.props.workflow;
        const trajectoryId = analysis.props.trajectory;

        const exposureNode = workflow.props.nodes
            .filter((node: Record<string, unknown>) => node.type === WorkflowNodeType.Exposure)
            .find((node: Record<string, unknown>) => String(node.id) === String(exposureId));

        if (!exposureNode) throw new ApplicationError(ErrorCodes.PLUGIN_NODE_NOT_FOUND, ErrorCodes.PLUGIN_NODE_NOT_FOUND, 404);

        const exposureName: string = typeof exposureNode?.data?.exposure?.name === 'string'
            ? exposureNode.data.exposure.name.trim()
            : '';

        const perAtomProperties = await this.discoverPerAtomPropertyNames(
            trajectoryId,
            analysisId,
            String(exposureId)
        );

        return {
            exposureId: String(exposureId),
            exposureName,
            perAtomProperties,
            schemaKeysMap: new Map()
        };
    }

    async getModifierAnalysis(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string
    ): Promise<Record<string, unknown>[] | null> {
        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, timestep);
        const stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, key);

        let decoded: Record<string, unknown> | null = null;

        for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
            if (message && typeof message === 'object') {
                decoded = mergeChunkedValue(decoded, message);
            }
        }

        if (!decoded) return null;

        const perAtomProperties = decoded['per-atom-properties'];
        if (Array.isArray(perAtomProperties)) {
            return perAtomProperties as Record<string, unknown>[];
        }

        return null;
    }

    async buildPluginIndexForAtomIds(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        targetIds: Set<number>
    ): Promise<Map<number, Record<string, unknown>> | null> {
        if (targetIds.size === 0) return null;

        const config = await this.getExposureAtomConfig(analysisId, exposureId);
        if (config.perAtomProperties.length === 0) return null;

        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, timestep);
        const pluginStream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, key);

        const pluginIndex = new Map<number, Record<string, unknown>>();
        const stream = pluginStream as unknown as AsyncIterable<Uint8Array>;

        for await (const message of decodeMultiStream(stream)) {
            const decoded = message as Record<string, unknown> | null;
            if (!decoded || typeof decoded !== 'object') continue;

            const perAtomData = decoded['per-atom-properties'];
            if (!Array.isArray(perAtomData)) continue;

            let shouldBreak = false;
            for (const item of perAtomData) {
                if (shouldBreak) break;

                const id = (item as Record<string, unknown>)?.id as number | undefined;
                if (id === undefined) continue;
                if (!targetIds.has(id)) continue;

                pluginIndex.set(id, item as Record<string, unknown>);

                if (pluginIndex.size >= targetIds.size) {
                    shouldBreak = true;
                }
            }

            if (shouldBreak) {
                if (typeof (pluginStream as Record<string, unknown> & { destroy?: () => void }).destroy === 'function') {
                    (pluginStream as Record<string, unknown> & { destroy: () => void }).destroy();
                }
                return pluginIndex;
            }
        }

        return pluginIndex.size > 0 ? pluginIndex : null;
    }

    toFloat32ByAtomId(data: unknown, property: string): Float32Array | undefined {
        if (!data) return undefined;

        const dataRecord = data as Record<string, unknown>;

        if (dataRecord[property] instanceof Float32Array) return dataRecord[property] as Float32Array;
        if (dataRecord[property] instanceof Float64Array) return new Float32Array(dataRecord[property] as Float64Array);

        if (Array.isArray(dataRecord[property])) {
            return new Float32Array(dataRecord[property] as number[]);
        }

        if (!Array.isArray(data) || (data as unknown[]).length === 0) return undefined;

        const items = data as Array<Record<string, unknown>>;
        let maxId = 0;
        for (let i = 0; i < items.length; i++) {
            const id = items[i]?.id as number | undefined;
            if (typeof id === 'number' && id > maxId) maxId = id;
        }
        if (maxId <= 0) return undefined;

        const out = new Float32Array(maxId + 1);

        const first = items[0];
        const isVector = Array.isArray(first?.[property]);

        if (!isVector) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const id = item?.id as number | undefined;
                if (typeof id !== 'number') continue;
                out[id] = Number(item?.[property]) || 0;
            }
            return out;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const id = item?.id as number | undefined;
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

    getMinMaxFromData(data: unknown, property: string): { min: number; max: number } | undefined {
        const dataRecord = data as Record<string, unknown>;

        if (dataRecord && (dataRecord[property] instanceof Float32Array || dataRecord[property] instanceof Float64Array)) {
            const arr = dataRecord[property] instanceof Float32Array
                ? dataRecord[property] as Float32Array
                : new Float32Array(dataRecord[property] as Float64Array);
            const result = nativeStats.getMinMaxFromTypedArray(arr);
            return result || undefined;
        }

        if (dataRecord && Array.isArray(dataRecord[property])) {
            const arr = new Float32Array(dataRecord[property] as number[]);
            const result = nativeStats.getMinMaxFromTypedArray(arr);
            return result || undefined;
        }

        if (Array.isArray(data)) {
            const arr = this.toFloat32ByAtomId(data, property);
            if (!arr) return undefined;

            const result = nativeStats.getMinMaxFromTypedArray(arr);
            return result || undefined;
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
            if (!dumpFilePath) throw new ApplicationError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);

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
            if (!dumpFilePath) throw new ApplicationError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);

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

    private async discoverPerAtomPropertyNames(
        trajectoryId: string,
        analysisId: string,
        exposureId: string
    ): Promise<string[]> {
        const prefix = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/`;
        let firstObjectName: string | null = null;

        for await (const objectName of this.storageService.listByPrefix(SYS_BUCKETS.PLUGINS, prefix, true)) {
            if (objectName.endsWith('.msgpack')) {
                firstObjectName = objectName;
                break;
            }
        }

        if (!firstObjectName) return [];

        const stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, firstObjectName);
        let decoded: Record<string, unknown> | null = null;

        for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
            if (message && typeof message === 'object') {
                decoded = mergeChunkedValue(decoded, message);
            }
        }

        if (!decoded) return [];

        const perAtomProperties = decoded['per-atom-properties'];
        if (!Array.isArray(perAtomProperties) || perAtomProperties.length === 0) return [];

        const firstItem = perAtomProperties[0] as Record<string, unknown>;
        return Object.keys(firstItem).filter((key) => key !== 'id');
    }

    private getPluginMsgpackKey(trajectoryId: string, analysisId: string, exposureId: string, timestep: string): string {
        return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
    }

    private async getAnalysisAndPlugin(analysisId: string): Promise<{ analysis: Analysis; plugin: Plugin }> {
        const analysis = await this.analysisRepository.findById(analysisId);
        if (!analysis) throw new ApplicationError(ErrorCodes.ANALYSIS_NOT_FOUND, ErrorCodes.ANALYSIS_NOT_FOUND, 404);

        const plugin = await this.pluginRepository.findOne({ _id: analysis.props.plugin });
        if (!plugin) throw new ApplicationError(ErrorCodes.PLUGIN_NOT_FOUND, ErrorCodes.PLUGIN_NOT_FOUND, 404);

        return { analysis, plugin };
    }
}
