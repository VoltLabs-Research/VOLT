import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { IAtomPropertiesService, FilterExpression, FilterResult, ExposureAtomConfig } from '@modules/trajectory/domain/port/trajectory/IAtomPropertiesService';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { getPropertyValues } from '@modules/trajectory/utilities/trajectory/get-property-values';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { decodeMultiStream } from '@shared/infrastructure/utilities/msgpack';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import mergeChunkedValue from '@modules/plugin/utilities/exposure/merge-chunked-value';
import nativeStats from '@modules/trajectory/infrastructure/native/trajectory/NativeStats';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/trajectory/TrajectoryParserFactory';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { Readable } from 'node:stream';

type PerAtomRow = Record<string, unknown>;
type PerAtomColumnarData = Record<string, unknown[]>;

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
            (node) => node.type === WorkflowNodeType.Exposure
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
            .filter((node) => node.type === WorkflowNodeType.Exposure)
            .find((node) => String(node.id) === String(exposureId));

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

        return this.normalizePerAtomProperties(decoded['per-atom-properties']);
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

            const perAtomData = this.normalizePerAtomProperties(decoded['per-atom-properties']);
            if (!perAtomData) continue;

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
                const readableStream = pluginStream as unknown as Readable & { destroy?: () => void };
                if (typeof readableStream.destroy === 'function') {
                    readableStream.destroy();
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

            const parsed = isStandard
                ? await TrajectoryParserFactory.parse(dumpFilePath, {
                    includeIds: lowerProp === 'id',
                    properties: []
                })
                : await TrajectoryParserFactory.parse(dumpFilePath, { properties: [expression.property] });

            values = getPropertyValues(parsed, expression.property);
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

        return this.extractPerAtomPropertyNames(decoded['per-atom-properties']);
    }

    private getPluginMsgpackKey(trajectoryId: string, analysisId: string, exposureId: string, timestep: string): string {
        return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
    }

    private async getAnalysisAndPlugin(analysisId: string): Promise<{ analysis: Analysis; plugin: Plugin }> {
        const analysis = await this.analysisRepository.findById(analysisId);
        if (!analysis) throw new ApplicationError(ErrorCodes.ANALYSIS_NOT_FOUND, ErrorCodes.ANALYSIS_NOT_FOUND, 404);

        const plugin = await this.pluginRepository.findById(analysis.props.plugin);
        if (!plugin) throw new ApplicationError(ErrorCodes.PLUGIN_NOT_FOUND, ErrorCodes.PLUGIN_NOT_FOUND, 404);

        return { analysis, plugin };
    }

    private extractPerAtomPropertyNames(value: unknown): string[] {
        const rows = this.normalizePerAtomProperties(value);
        if (!rows || rows.length === 0) {
            return [];
        }

        const keys = new Set<string>();
        for (const row of rows) {
            for (const key of Object.keys(row)) {
                if (key !== 'id') {
                    keys.add(key);
                }
            }
        }

        return Array.from(keys);
    }

    private normalizePerAtomProperties(value: unknown): PerAtomRow[] | null {
        if (Array.isArray(value)) {
            return value.map((item) => this.flattenPerAtomRow(item as PerAtomRow));
        }

        if (!this.isColumnarPerAtomData(value)) {
            return null;
        }

        const entries = Object.entries(value);
        if (entries.length === 0) {
            return [];
        }

        const rowCount = entries[0]?.[1]?.length ?? 0;
        const rows: PerAtomRow[] = Array.from({ length: rowCount }, () => ({}));

        for (const [key, column] of entries) {
            for (let index = 0; index < rowCount; index++) {
                rows[index][key] = column[index];
            }
        }

        return rows.map((row) => this.flattenPerAtomRow(row));
    }

    private flattenPerAtomRow(row: PerAtomRow): PerAtomRow {
        const flattened: PerAtomRow = {};

        for (const [key, value] of Object.entries(row)) {
            if (key === 'id' || !Array.isArray(value)) {
                flattened[key] = value;
                continue;
            }

            for (let index = 0; index < value.length; index++) {
                flattened[`${key}[${index}]`] = value[index];
            }
        }

        return flattened;
    }

    private isColumnarPerAtomData(value: unknown): value is PerAtomColumnarData {
        if (!value || Array.isArray(value) || typeof value !== 'object') {
            return false;
        }

        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) {
            return false;
        }

        let expectedLength: number | null = null;

        for (const [, column] of entries) {
            if (!Array.isArray(column)) {
                return false;
            }

            if (expectedLength === null) {
                expectedLength = column.length;
                continue;
            }

            if (column.length !== expectedLength) {
                return false;
            }
        }

        return true;
    }
};
