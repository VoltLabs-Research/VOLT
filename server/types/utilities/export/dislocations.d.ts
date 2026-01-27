/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
