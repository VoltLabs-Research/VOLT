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

export interface IAtomPropertiesService {
    getModifierPerAtomProps(analysisId: string): Promise<Record<string, string[]>>;

    getExposureAtomConfig(analysisId: string, exposureId: string): Promise<ExposureAtomConfig>;

    getModifierAnalysis(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string
    ): Promise<any>;

    buildPluginIndexForAtomIds(
        trajectoryId: string,
        analysisId: string,
        exposureId: string,
        timestep: string,
        targetIds: Set<number>
    ): Promise<Map<number, any> | null>;

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
