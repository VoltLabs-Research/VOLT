import type { Readable } from 'node:stream';
import { decodeMultiStream, mergeSelectiveChunk } from '@/shared/utilities/selective-msgpack';
import { isRecord } from '@/shared/utilities/type-guards';
import { ObjectBucketName } from '@/shared/contracts';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import { createZstdDecompressionStream } from '@/shared/utilities/storage-codec';

type PerAtomRow = Record<string, unknown>;
type PerAtomColumnarData = Record<string, unknown[]>;

interface PluginPropertyNamesRequest {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep?: number;
    ownerClusterId: string;
}

interface PluginModifierAnalysisRequest {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    ownerClusterId: string;
}

interface PluginAtomIndexRequest {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    targetIds: number[];
    ownerClusterId: string;
}

interface PluginModifierValuesRequest extends PluginModifierAnalysisRequest {
    property: string;
}

interface PluginModifierUniqueValuesRequest extends PluginModifierValuesRequest {
    maxValues?: number;
}

interface PluginAnalysisAllAtomsRequest {
    trajectoryId: string;
    analysisId: string;
    timestep: number;
    atomIds?: Set<number>;
    ownerClusterId: string;
}

interface PluginAnalysisAllAtomsResponse {
    propertyNames: string[];
    atoms: Record<string, unknown>[];
};

interface PluginAtomIndex {
    [atomId: number]: Record<string, unknown>;
};

interface ExposureData {
    exposureId: string;
    propertyNames: string[];
    rows: Record<string, unknown>[];
};

function getMinMaxFromTypedArray(arr: Float32Array | Float64Array | Int32Array | Uint32Array): { min: number; max: number } | undefined {
    if (arr.length === 0) return undefined;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (!Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
    }

    if (min === Infinity || max === -Infinity) {
        return undefined;
    }

    return { min, max };
}

export class TrajectoryPluginParserService {
    constructor(
        private readonly objectStore: ClusterObjectStore
    ) {}

    async discoverPerAtomPropertyNames(request: PluginPropertyNamesRequest): Promise<string[]> {
        const { trajectoryId, analysisId, exposureId, timestep, ownerClusterId } = request;
        let objectName: string | null = null;

        if (typeof timestep === 'number') {
            objectName = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, String(timestep));
        } else {
            const prefix = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/`;
            const objects = await this.listAllObjectKeys(ownerClusterId, ObjectBucketName.Plugins, prefix);

            for (const candidateObjectName of objects) {
                if (candidateObjectName.endsWith('.msgpack.zst')) {
                    objectName = candidateObjectName;
                    break;
                }
            }
        }

        if (!objectName) return [];

        try {
            const response = await this.objectStore.getStream(ownerClusterId, ObjectBucketName.Plugins, objectName, { skipMetadata: true });
            const stream = createZstdDecompressionStream(response.stream).stream;

            let decoded: Record<string, unknown> | null = null;
            for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
                decoded = mergeSelectiveChunk(decoded, message, (key) => key === 'per-atom-properties');
            }

            if (!decoded) return [];

            const rows = this.normalizePerAtomProperties(decoded['per-atom-properties']);
            if (!rows?.length) {
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
        } catch {
            return [];
        }
    }

    async getModifierAnalysisData(request: PluginModifierAnalysisRequest): Promise<Record<string, unknown>[] | null> {
        const { trajectoryId, analysisId, exposureId, timestep, ownerClusterId } = request;
        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, String(timestep));
        
        try {
            const response = await this.objectStore.getStream(ownerClusterId, ObjectBucketName.Plugins, key, { skipMetadata: true });
            const stream = createZstdDecompressionStream(response.stream).stream;

            let decoded: Record<string, unknown> | null = null;
            for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
                decoded = mergeSelectiveChunk(decoded, message, (k) => k === 'per-atom-properties');
            }

            if (!decoded) return null;
            return this.normalizePerAtomProperties(decoded['per-atom-properties']);
        } catch {
            return null;
        }
    }

    async getModifierValues(request: PluginModifierValuesRequest): Promise<Float32Array | null> {
        const data = await this.getModifierAnalysisData(request);
        if (!data) return null;
        return this.toFloat32ByAtomId(data, request.property) || null;
    }

    async getModifierStats(request: PluginModifierValuesRequest): Promise<{ min: number; max: number } | null> {
        const data = await this.getModifierAnalysisData(request);
        if (!data) return null;
        const arr = this.toFloat32ByAtomId(data, request.property);
        return arr ? getMinMaxFromTypedArray(arr) || null : null;
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

    async buildPluginIndexForAtomIds(request: PluginAtomIndexRequest): Promise<PluginAtomIndex | null> {
        const { trajectoryId, analysisId, exposureId, timestep, targetIds, ownerClusterId } = request;
        const targetIdsSet = new Set(targetIds);

        if (targetIdsSet.size === 0) return null;

        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, String(timestep));
        
        try {
            const response = await this.objectStore.getStream(ownerClusterId, ObjectBucketName.Plugins, key, { skipMetadata: true });
            const pluginIndex: PluginAtomIndex = {};
            let matchedAtomCount = 0;
            const stream = createZstdDecompressionStream(response.stream).stream as unknown as AsyncIterable<Uint8Array>;

            for await (const message of decodeMultiStream(stream)) {
                if (!isRecord(message)) continue;

                const perAtomRaw = message['per-atom-properties'];
                const perAtomData = this.normalizePerAtomProperties(perAtomRaw);
                if (!perAtomData) continue;

                let shouldBreak = false;
                for (const item of perAtomData) {
                    if (shouldBreak) break;

                    const id = this.normalizeAtomId(item.id);
                    if (id === null) continue;
                    if (!targetIdsSet.has(id)) continue;
                    if (pluginIndex[id]) continue;

                    pluginIndex[id] = item as Record<string, unknown>;
                    matchedAtomCount += 1;

                    if (matchedAtomCount >= targetIdsSet.size) {
                        shouldBreak = true;
                    }
                }

                if (shouldBreak) {
                    const readableStream = response.stream as unknown as Readable & { destroy?: () => void };
                    if (typeof readableStream.destroy === 'function') {
                        readableStream.destroy();
                    }
                    return pluginIndex;
                }
            }

            return matchedAtomCount > 0 ? pluginIndex : null;
        } catch {
            return null;
        }
    }

    private async listAllObjectKeys(ownerClusterId: string, bucket: ObjectBucketName, prefix: string): Promise<string[]> {
        const keys: string[] = [];
        let cursor: string | undefined;

        do {
            const page = await this.objectStore.list(ownerClusterId, {
                bucket,
                prefix,
                cursor,
                limit: 200
            });
            keys.push(...page.keys);
            cursor = page.nextCursor;
        } while (cursor);

        return keys;
    }

    async getAnalysisAllPerAtomData(request: PluginAnalysisAllAtomsRequest): Promise<PluginAnalysisAllAtomsResponse> {
        const { trajectoryId, analysisId, timestep, ownerClusterId } = request;
        const analysisPrefix = `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`;

        const allObjects = await this.listAllObjectKeys(ownerClusterId, ObjectBucketName.Plugins, analysisPrefix);

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
            const data = await this.getModifierAnalysisData({
                trajectoryId,
                analysisId,
                exposureId,
                timestep,
                ownerClusterId
            });

            if (!data || data.length === 0) continue;

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
        }

        if (exposureResults.length === 0) {
            return { propertyNames: [], atoms: [] };
        }

        const propertyOccurrences = new Map<string, number>();
        for (const result of exposureResults) {
            for (const prop of result.propertyNames) {
                propertyOccurrences.set(prop, (propertyOccurrences.get(prop) || 0) + 1);
            }
        }

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

        const mergedAtoms = new Map<number, Record<string, unknown>>();
        const { atomIds } = request;

        for (const result of exposureResults) {
            const mapping = exposureMappings.get(result.exposureId)!;
            for (const row of result.rows) {
                const atomId = this.normalizeAtomId(row.id);
                if (atomId === null) continue;
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
        return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack.zst`;
    }

    private toFloat32ByAtomId(data: unknown, property: string): Float32Array | undefined {
        if (!Array.isArray(data) || (data as unknown[]).length === 0) return undefined;

        const items = data as Array<Record<string, unknown>>;
        let maxId = 0;
        for (let i = 0; i < items.length; i++) {
            const id = this.normalizeAtomId(items[i]?.id);
            if (id !== null && id > maxId) maxId = id;
        }
        if (maxId <= 0) return undefined;

        const out = new Float32Array(maxId + 1);
        out.fill(Number.NaN);

        const first = items[0];
        const isVector = Array.isArray(first?.[property]);

        if (!isVector) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const id = this.normalizeAtomId(item?.id);
                if (id === null) continue;
                const value = Number(item?.[property]);
                if (Number.isFinite(value)) {
                    out[id] = value;
                }
            }
            return out;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const id = this.normalizeAtomId(item?.id);
            if (id === null) continue;

            const vec = item?.[property] as number[] | undefined;
            if (!Array.isArray(vec) || vec.length === 0) continue;

            let sum = 0;
            for (let k = 0; k < vec.length; k++) {
                const v = Number(vec[k]);
                if (!Number.isFinite(v)) {
                    sum = Number.NaN;
                    break;
                }
                sum += v * v;
            }
            if (Number.isFinite(sum)) {
                out[id] = Math.sqrt(sum);
            }
        }

        return out;
    }

    private normalizeAtomId(value: unknown): number | null {
        const parsed = typeof value === 'string'
            ? Number(value.trim())
            : typeof value === 'number'
                ? value
                : Number.NaN;

        if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
            return null;
        }

        return parsed;
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
