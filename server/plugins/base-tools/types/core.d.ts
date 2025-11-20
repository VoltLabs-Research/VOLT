export interface ArtifactExport{
    name: string;
    handler?: string;
    type: string;
    opts?: any;
};

export interface Artifact{
    name: string;
    resultFile: string;
    exportConfig?: ArtifactExport;
    iterableKey?: string;
    iterableChunkSize?: number;
}

export interface ArtifactTransformContext{
    pluginName: string;
    trajectoryId: string;
    analysisId: string;
    timestep: number;
    artifact: Artifact;
    filePath: string;

    iterateChunks(): AsyncIterable<Buffer>;
    readAllAsBuffer(): Promise<Buffer>;
    writeChunk(chunk: unknown): Promise<void>;
}

export type ArtifactTransformer = (ctx: ArtifactTransformContext) => Promise<any | null> | any | null;  

export type AnyRecord = Record<string, any>;