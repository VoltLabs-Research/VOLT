import type { Readable } from 'node:stream';
import type { MinioService } from '@/modules/platform/services';
import { decodeMultiStream } from '@/shared/utilities/msgpack';
import mergeChunkedValue from '@/shared/utilities/merge-chunked-value';
import { isRecord } from '@/shared/utilities/type-guards';
import { ObjectBucketName } from '@/shared/contracts';

type PerAtomRow = Record<string, unknown>;
type PerAtomColumnarData = Record<string, unknown[]>;

const mergeSelectiveChunk = (
    target: Record<string, unknown> | null,
    incoming: unknown,
    keyFilter: (key: string) => boolean
): Record<string, unknown> | null => {
    if (!isRecord(incoming)) {
        return target;
    }

    const filtered: Record<string, unknown> = {};
    for (const [key, incomingValue] of Object.entries(incoming)) {
        if (keyFilter(key)) {
            filtered[key] = incomingValue;
        }
    }

    if (Object.keys(filtered).length === 0) {
        return target;
    }

    const merged = mergeChunkedValue(target, filtered);
    return isRecord(merged) ? merged : target;
};

export interface PluginPropertyNamesRequest {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
}

export interface PluginModifierAnalysisRequest {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
}

export interface PluginAtomIndexRequest {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    targetIds: number[];
}

export interface PluginModifierValuesRequest extends PluginModifierAnalysisRequest {
    property: string;
}

export interface PluginModifierStatsRequest extends PluginModifierValuesRequest {}

export interface PluginModifierUniqueValuesRequest extends PluginModifierValuesRequest {
    maxValues?: number;
}

export interface PluginAnalysisAllAtomsRequest {
    trajectoryId: string;
    analysisId: string;
    timestep: number;
    atomIds?: Set<number>;
}

export interface PluginAnalysisAllAtomsResponse {
    propertyNames: string[];
    atoms: Record<string, unknown>[];
}

interface ExposureData {
    exposureId: string;
    propertyNames: string[];
    rows: Record<string, unknown>[];
};

function getMinMaxFromTypedArray(arr: Float32Array | Float64Array | Int32Array | Uint32Array): { min: number; max: number } | undefined {
    if (arr.length === 0) return undefined;
    let min = arr[0];
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) {
        const v = arr[i];
        if (v < min) min = v;
        if (v > max) max = v;
    }
    return { min, max };
}

export class TrajectoryPluginParserService {
    constructor(
        private readonly minioService: MinioService
    ) {}

    async discoverPerAtomPropertyNames(request: PluginPropertyNamesRequest): Promise<string[]> {
        const { trajectoryId, analysisId, exposureId } = request;
        const prefix = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/`;
        let firstObjectName: string | null = null;

        const objects = await this.minioService.listObjects(ObjectBucketName.Plugins, prefix);
        for (const objectName of objects) {
            if (objectName.endsWith('.msgpack')) {
                firstObjectName = objectName;
                break;
            }
        }

        if (!firstObjectName) return [];

        const stream = await this.minioService.getObjectStream(ObjectBucketName.Plugins, firstObjectName);

        // Selective decode: only keep 'per-atom-properties' key, discard everything else
        let decoded: Record<string, unknown> | null = null;
        for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
            decoded = mergeSelectiveChunk(decoded, message, (key) => key === 'per-atom-properties');
        }

        if (!decoded) return [];

        return this.extractPerAtomPropertyNames(decoded['per-atom-properties']);
    }

    async getModifierAnalysisData(request: PluginModifierAnalysisRequest): Promise<Record<string, unknown>[] | null> {
        const { trajectoryId, analysisId, exposureId, timestep } = request;
        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, String(timestep));
        
        try {
            const stream = await this.minioService.getObjectStream(ObjectBucketName.Plugins, key);

            // Selective decode: only keep 'per-atom-properties' key
            let decoded: Record<string, unknown> | null = null;
            for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
                decoded = mergeSelectiveChunk(decoded, message, (k) => k === 'per-atom-properties');
            }

            if (!decoded) return null;
            return this.normalizePerAtomProperties(decoded['per-atom-properties']);
        } catch (error) {
            // Return null if object does not exist
            return null;
        }
    }

    async getModifierValues(request: PluginModifierValuesRequest): Promise<Float32Array | null> {
        const data = await this.getModifierAnalysisData(request);
        if (!data) return null;
        return this.toFloat32ByAtomId(data, request.property) || null;
    }

    async getModifierStats(request: PluginModifierStatsRequest): Promise<{ min: number; max: number } | null> {
        const data = await this.getModifierAnalysisData(request);
        if (!data) return null;
        return this.getMinMaxFromData(data, request.property) || null;
    }

    async getModifierUniqueValues(request: PluginModifierUniqueValuesRequest): Promise<number[]> {
        const { property, maxValues = 100 } = request;
        const data = await this.getModifierAnalysisData(request);
        if (!data) return [];

        const uniqueSet = new Set<number>();
        for (const atom of data) {
            if (atom[property] !== undefined && uniqueSet.size < maxValues) {
                uniqueSet.add(Number(atom[property]));
            }
        }
        return Array.from(uniqueSet).sort((a, b) => a - b);
    }

    async buildPluginIndexForAtomIds(request: PluginAtomIndexRequest): Promise<Map<number, Record<string, unknown>> | null> {
        const { trajectoryId, analysisId, exposureId, timestep, targetIds } = request;
        const targetIdsSet = new Set(targetIds);
        
        if (targetIdsSet.size === 0) return null;

        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, String(timestep));
        
        try {
            const pluginStream = await this.minioService.getObjectStream(ObjectBucketName.Plugins, key);
            const pluginIndex = new Map<number, Record<string, unknown>>();
            const stream = pluginStream as unknown as AsyncIterable<Uint8Array>;

            for await (const message of decodeMultiStream(stream)) {
                if (!isRecord(message)) continue;

                // Only extract per-atom-properties from each chunk
                const perAtomRaw = message['per-atom-properties'];
                const perAtomData = this.normalizePerAtomProperties(perAtomRaw);
                if (!perAtomData) continue;

                let shouldBreak = false;
                for (const item of perAtomData) {
                    if (shouldBreak) break;

                    const id = (item as Record<string, unknown>)?.id as number | undefined;
                    if (id === undefined) continue;
                    if (!targetIdsSet.has(id)) continue;

                    pluginIndex.set(id, item as Record<string, unknown>);

                    if (pluginIndex.size >= targetIdsSet.size) {
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
        } catch (error) {
            return null;
        }
    }

    /**
     * Fetches per-atom data for all exposures in a given analysis at a specific timestep,
     * merging results into a single flat response with deduplicated property names.
     *
     * @param request - The trajectory, analysis, and timestep to query.
     * @returns Merged property names and atom records across all exposures.
     */
    async getAnalysisAllPerAtomData(request: PluginAnalysisAllAtomsRequest): Promise<PluginAnalysisAllAtomsResponse> {
        const { trajectoryId, analysisId, timestep } = request;
        const analysisPrefix = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`;

        const allObjects = await this.minioService.listObjects(ObjectBucketName.Plugins, analysisPrefix);

        // Extract unique exposure IDs from object paths
        // Path format: plugins/trajectory-{id}/analysis-{id}/{exposureId}/timestep-{ts}.msgpack
        const exposureIds = new Set<string>();
        for (const objectKey of allObjects) {
            const relativePath = objectKey.slice(analysisPrefix.length);
            const slashIndex = relativePath.indexOf('/');
            if (slashIndex > 0) {
                exposureIds.add(relativePath.slice(0, slashIndex));
            }
        }

        if (exposureIds.size === 0) {
            return { propertyNames: [], atoms: [] };
        }

        const exposureResults: ExposureData[] = [];

        for (const exposureId of exposureIds) {
            try {
                const data = await this.getModifierAnalysisData({
                    trajectoryId,
                    analysisId,
                    exposureId,
                    timestep
                });

                if (!data || data.length === 0) continue;

                // Extract property names from already-normalized rows (avoids double-normalization)
                const keys = new Set<string>();
                for (const row of data) {
                    for (const key of Object.keys(row)) {
                        if (key !== 'id') keys.add(key);
                    }
                }

                const propNames = Array.from(keys);
                if (propNames.length === 0) continue;

                exposureResults.push({
                    exposureId,
                    propertyNames: propNames,
                    rows: data
                });
            } catch {
                continue;
            }
        }

        if (exposureResults.length === 0) {
            return { propertyNames: [], atoms: [] };
        }

        // Count property name occurrences across exposures for deduplication
        const propertyOccurrences = new Map<string, number>();
        for (const result of exposureResults) {
            for (const prop of result.propertyNames) {
                propertyOccurrences.set(prop, (propertyOccurrences.get(prop) || 0) + 1);
            }
        }

        // Build per-exposure property name mappings (source -> display)
        // If a property name appears in multiple exposures, prefix with exposureId
        const exposureMappings = new Map<string, Map<string, string>>();
        const allDisplayNames: string[] = [];

        for (const result of exposureResults) {
            const mapping = new Map<string, string>();
            for (const prop of result.propertyNames) {
                const occurrences = propertyOccurrences.get(prop) || 1;
                const displayName = occurrences > 1
                    ? `${result.exposureId}: ${prop}`
                    : prop;
                mapping.set(prop, displayName);
                allDisplayNames.push(displayName);
            }
            exposureMappings.set(result.exposureId, mapping);
        }

        // Merge all per-atom rows by atom id
        const mergedAtoms = new Map<number, Record<string, unknown>>();
        const { atomIds } = request;

        for (const result of exposureResults) {
            const mapping = exposureMappings.get(result.exposureId)!;
            for (const row of result.rows) {
                if (row.id === undefined) continue;
                const atomId = Number(row.id);
                if (atomIds && !atomIds.has(atomId)) continue;
                const existing = mergedAtoms.get(atomId) ?? { id: atomId };

                for (const [source, display] of mapping.entries()) {
                    if (row[source] !== undefined) {
                        existing[display] = row[source];
                    }
                }

                mergedAtoms.set(atomId, existing);
            }
        }

        const atoms = Array.from(mergedAtoms.values()).sort((a, b) => Number(a.id) - Number(b.id));

        return { propertyNames: allDisplayNames, atoms };
    }

    private getPluginMsgpackKey(trajectoryId: string, analysisId: string, exposureId: string, timestep: string): string {
        return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack`;
    }

    private toFloat32ByAtomId(data: unknown, property: string): Float32Array | undefined {
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

    private getMinMaxFromData(data: unknown, property: string): { min: number; max: number } | undefined {
        const dataRecord = data as Record<string, unknown>;

        if (dataRecord && (dataRecord[property] instanceof Float32Array || dataRecord[property] instanceof Float64Array)) {
            const arr = dataRecord[property] instanceof Float32Array
                ? dataRecord[property] as Float32Array
                : new Float32Array(dataRecord[property] as Float64Array);
            return getMinMaxFromTypedArray(arr);
        }

        if (dataRecord && Array.isArray(dataRecord[property])) {
            const arr = new Float32Array(dataRecord[property] as number[]);
            return getMinMaxFromTypedArray(arr);
        }

        if (Array.isArray(data)) {
            const arr = this.toFloat32ByAtomId(data, property);
            if (!arr) return undefined;
            return getMinMaxFromTypedArray(arr);
        }

        return undefined;
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
}
