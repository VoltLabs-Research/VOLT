import type { FlatAtomProperties } from '@/modules/plugin/application/properties/PluginAtomProperties';

export interface PluginExposureRequestBase {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    ownerClusterId: string;
}

export type PluginPropertyNamesRequest = PluginExposureRequestBase & { timestep?: number };
export type PluginModifierAnalysisRequest = PluginExposureRequestBase & { timestep: number };
export type PluginAtomIndexRequest = PluginModifierAnalysisRequest & { targetIds: number[] };

export interface PluginModifierValuesRequest extends PluginModifierAnalysisRequest {
    property: string;
}

export interface PluginModifierUniqueValuesRequest extends PluginModifierValuesRequest {
    maxValues?: number;
}

export type PluginAnalysisAllAtomsRequest = Omit<PluginModifierAnalysisRequest, 'exposureId'> & {
    atomIds?: Set<number>;
};

export interface PluginAnalysisAllAtomsResponse {
    propertyNames: string[];
    atoms: FlatAtomProperties[];
}

export interface PluginPropertyStoreWriteInput extends PluginModifierAnalysisRequest {
    rows: FlatAtomProperties[];
}

export interface PluginPropertyStoreWriteResult {
    objectKey: string;
    rowCount: number;
    propertyNames: string[];
}

export type PluginAtomIndex = Record<number, FlatAtomProperties>;
export type ModifierStats = { min: number; max: number };

export interface PluginPropertyStore {
    writeExposureProperties(input: PluginPropertyStoreWriteInput): Promise<PluginPropertyStoreWriteResult | null>;
    discoverPerAtomPropertyNames(request: PluginPropertyNamesRequest): Promise<string[]>;
    getModifierAnalysisData(request: PluginModifierAnalysisRequest): Promise<FlatAtomProperties[] | null>;
    getModifierValues(request: PluginModifierValuesRequest): Promise<Float32Array | null>;
    getModifierStats(request: PluginModifierValuesRequest): Promise<ModifierStats | null>;
    getModifierUniqueValues(request: PluginModifierUniqueValuesRequest): Promise<number[]>;
    buildPluginIndexForAtomIds(request: PluginAtomIndexRequest): Promise<PluginAtomIndex | null>;
    getAnalysisAllPerAtomData(request: PluginAnalysisAllAtomsRequest): Promise<PluginAnalysisAllAtomsResponse>;
}
