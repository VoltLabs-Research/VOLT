import { decodeMultiStream, mergeSelectiveChunk } from '@/support/serialization/selective-msgpack';
import { isRecord } from '@/support/type-guards/is-record';
import { ObjectBucketName } from '@/contracts';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { createZstdDecompressionStream } from '@/support/serialization/storage-codec';

type AtomScalar = string | number | boolean | null;
type AtomVector = AtomScalar[];
type AtomPropertyValue = AtomScalar | AtomVector;
type AtomId = string | number;
type PluginDecodedValue = AtomPropertyValue | PerAtomProperties | null | undefined;

interface AtomProperties {
    id?: AtomId;
    [key: string]: AtomPropertyValue | undefined;
}

type PerAtomRow = AtomProperties;
type PerAtomColumnarData = Record<string, AtomPropertyValue[]>;
type PerAtomProperties = PerAtomRow[] | PerAtomColumnarData;
interface PluginDecodedPayload {
    'per-atom-properties'?: PerAtomProperties | null;
    [key: string]: PluginDecodedValue;
}
type ModifierStats = { min: number; max: number };

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
    atoms: AtomProperties[];
}

interface PluginAtomIndex {
    [atomId: number]: AtomProperties;
}

interface ExposureData {
    exposureId: string;
    propertyNames: string[];
    rows: AtomProperties[];
}

function getMinMaxFromTypedArray(arr: Float32Array | Float64Array | Int32Array | Uint32Array): ModifierStats | undefined {
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

export class TrajectoryPluginParser {
    constructor(
        private readonly objectStore: ClusterObjectStore
    ) {}

    async discoverPerAtomPropertyNames(request: PluginPropertyNamesRequest): Promise<string[]> {
        const { trajectoryId, analysisId, exposureId, timestep, ownerClusterId } = request;
        let objectName: string | null = null;

        if (timestep !== undefined) {
            objectName = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, timestep);
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

            let decoded: PluginDecodedPayload | null = null;
            for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
                decoded = mergeSelectiveChunk(decoded, message, (key) => key === 'per-atom-properties') as PluginDecodedPayload;
            }

            if (!decoded) return [];

            const rows = this.normalizePerAtomProperties(decoded['per-atom-properties']);
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
        } catch {
            return [];
        }
    }

    async getModifierAnalysisData(request: PluginModifierAnalysisRequest): Promise<AtomProperties[] | null> {
        const { trajectoryId, analysisId, exposureId, timestep, ownerClusterId } = request;
        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, timestep);
        
        try {
            const response = await this.objectStore.getStream(ownerClusterId, ObjectBucketName.Plugins, key, { skipMetadata: true });
            const stream = createZstdDecompressionStream(response.stream).stream;

            let decoded: PluginDecodedPayload | null = null;
            for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
                decoded = mergeSelectiveChunk(decoded, message, (k) => k === 'per-atom-properties') as PluginDecodedPayload;
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
        const values = this.toFloat32ByAtomId(data, request.property);
        return values === undefined ? null : values;
    }

    async getModifierStats(request: PluginModifierValuesRequest): Promise<ModifierStats | null> {
        const data = await this.getModifierAnalysisData(request);
        if (!data) return null;
        const arr = this.toFloat32ByAtomId(data, request.property);
        if (!arr) return null;

        const stats = getMinMaxFromTypedArray(arr);
        return stats === undefined ? null : stats;
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

        const key = this.getPluginMsgpackKey(trajectoryId, analysisId, exposureId, timestep);
        
        try {
            const response = await this.objectStore.getStream(ownerClusterId, ObjectBucketName.Plugins, key, { skipMetadata: true });
            const pluginIndex: PluginAtomIndex = {};
            let matchedAtomCount = 0;
            const stream = createZstdDecompressionStream(response.stream).stream;

            for await (const message of decodeMultiStream(stream as AsyncIterable<Uint8Array>)) {
                if (!isRecord(message)) continue;

                const perAtomRaw = (message as PluginDecodedPayload)['per-atom-properties'];
                const perAtomData = this.normalizePerAtomProperties(perAtomRaw);
                if (!perAtomData) continue;

                let shouldBreak = false;
                for (const item of perAtomData) {
                    if (shouldBreak) break;

                    const id = this.normalizeAtomId(item.id);
                    if (id === null) continue;
                    if (!targetIdsSet.has(id)) continue;
                    if (pluginIndex[id]) continue;

                    pluginIndex[id] = item;
                    matchedAtomCount += 1;

                    if (matchedAtomCount >= targetIdsSet.size) {
                        shouldBreak = true;
                    }
                }

                if (shouldBreak) {
                    response.stream.destroy();
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
                const occurrences = propertyOccurrences.get(prop);
                propertyOccurrences.set(prop, occurrences === undefined ? 1 : occurrences + 1);
            }
        }

        const exposureMappings = new Map<string, Map<string, string>>();
        const allDisplayNames: string[] = [];

        for (const result of exposureResults) {
            const mapping = new Map<string, string>();
            for (const prop of result.propertyNames) {
                const occurrences = propertyOccurrences.get(prop)!;
                const displayName = occurrences > 1
                    ? `${result.exposureId}: ${prop}`
                    : prop;
                mapping.set(prop, displayName);
                allDisplayNames.push(displayName);
            }
            exposureMappings.set(result.exposureId, mapping);
        }

        const mergedAtoms = new Map<number, AtomProperties>();
        const { atomIds } = request;

        for (const result of exposureResults) {
            const mapping = exposureMappings.get(result.exposureId)!;
            for (const row of result.rows) {
                const atomId = this.normalizeAtomId(row.id);
                if (atomId === null) continue;
                if (atomIds && !atomIds.has(atomId)) continue;
                let existing = mergedAtoms.get(atomId);
                if (!existing) {
                    existing = { id: atomId };
                }

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

    private getPluginMsgpackKey(trajectoryId: string, analysisId: string, exposureId: string, timestep: number): string {
        return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.msgpack.zst`;
    }

    private toFloat32ByAtomId(items: AtomProperties[], property: string): Float32Array | undefined {
        if (items.length === 0) return undefined;

        let maxId = 0;
        for (let i = 0; i < items.length; i++) {
            const id = this.normalizeAtomId(items[i].id);
            if (id !== null && id > maxId) maxId = id;
        }
        if (maxId <= 0) return undefined;

        const out = new Float32Array(maxId + 1);
        out.fill(Number.NaN);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const id = this.normalizeAtomId(item.id);
            if (id === null) continue;
            const value = Number(item[property]);
            if (Number.isFinite(value)) {
                out[id] = value;
            }
        }

        return out;
    }

    private normalizeAtomId(value: AtomId | undefined): number | null {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 0) {
            return null;
        }

        return parsed;
    }

    private normalizePerAtomProperties(value: PerAtomProperties | null | undefined): PerAtomRow[] | null {
        if (Array.isArray(value)) {
            return value.map((item) => this.flattenPerAtomRow(item));
        }

        if (!this.isColumnarPerAtomData(value)) {
            return null;
        }

        const entries = Object.entries(value);
        if (entries.length === 0) {
            return [];
        }

        const rowCount = entries[0][1].length;
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

    private isColumnarPerAtomData(value: PerAtomProperties | null | undefined): value is PerAtomColumnarData {
        if (!value || Array.isArray(value) || typeof value !== 'object') {
            return false;
        }

        const entries = Object.entries(value);
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
