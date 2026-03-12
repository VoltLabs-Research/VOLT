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

    toFloat32ByAtomId(data: any, property: string): Float32Array | undefined;

    getMinMaxFromData(data: any, property: string): { min: number; max: number } | undefined;
};
