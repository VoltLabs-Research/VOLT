export interface Dislocation {
    metadata: {
        type: string;
        count: number;
    };
    data: {
        index: number;
        type: string;
        point_index_offset: number;
        num_points: number;
        length: number;
        points: [number, number, number][];
        burgers: {
            vector: [number, number, number];
            magnitude: number;
            fractional: string;
        };
        junction_info?: {
            forward_node_dangling: boolean;
            backward_node_dangling: boolean;
            junction_arms_count: number;
            forms_junction: boolean;
        };
        core_sizes?: number[];
        average_core_size?: number;
        is_closed_loop?: boolean;
        is_infinite_line?: boolean;
        segment_id?: number;
        line_direction?: {
            vector: [number, number, number];
            string: string;
        };
        nodes?: {
            forward: any;
            backward: any;
        };
    }[];
    summary: {
        total_points: number;
        average_segment_length: number;
        max_segment_length: number;
        min_segment_length: number;
        total_length: number;
    };
}

export interface DislocationExportOptions {
    lineWidth?: number;
    tubularSegments?: number;
    minSegmentPoints?: number;
    material?: {
        baseColor: [number, number, number, number];
        metallic: number;
        roughness: number;
        emissive: [number, number, number];
    };
    colorByType?: boolean;
    typeColors?: Record<string, [number, number, number, number]>;
    metadata?: {
        includeOriginalStats?: boolean;
        customProperties?: Record<string, any>;
    };
}

export interface ProcessedDislocationGeometry {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
    colors?: Float32Array;
    vertexCount: number;
    triangleCount: number;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
}
