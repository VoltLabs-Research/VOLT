export interface FilterExpression {
    property: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
    value: number;
};

export interface ExposureAtomConfig {
    exposureId: string;
    exposureName: string;
    iterableKey?: string;
    perAtomProperties: string[];
    schemaKeysMap: Map<string, string[]>;
};

export interface AnalysisAllAtomsResult {
    propertyNames: string[];
    atoms: Record<string, unknown>[];
};

export interface IAtomPropertiesService {
    getModifierPerAtomProps(analysisId: string): Promise<Record<string, string[]>>;

    getAnalysisExposureAtomConfigs(analysisId: string): Promise<ExposureAtomConfig[]>;

    getExposureAtomConfig(analysisId: string, exposureId: string): Promise<ExposureAtomConfig>;

    getAnalysisAllPerAtomProperties(
        teamClusterId: string,
        trajectoryId: string,
        analysisId: string,
        timestep: string
    ): Promise<AnalysisAllAtomsResult | null>;

    buildPluginIndexForAtomIds(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        targetIds: Set<number>
    ): Promise<Map<number, Record<string, unknown>> | null>;

    getModifierValues(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string
    ): Promise<Float32Array | undefined>;

    getModifierStats(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string
    ): Promise<{ min: number; max: number } | undefined>;

    getModifierUniqueValues(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        property: string,
        maxValues?: number
    ): Promise<number[]>;
};
