/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { quantize, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer';

/**
 * Options for combined mesh **quantization** and **Meshopt** compression.
 */
export type QuantizeMeshoptOptions = {
    quantization?: {
        /** Bit depth for POSITION attributes (default: 15). */
        positionBits?: number;
        /** Bit depth for COLOR_0 attributes (default: 8). */
        colorBits?: number;
    };
    /** 
     * Maximum allowable spatial error (in model units) used to infer `positionBits`
     * when `extent` is provided to {@link applyQuantizeAndMeshopt}.
     */
    epsilon?: number;
    /**
     * Whether to mark the `EXT_meshopt_compression` extension as **required** in the output.
     * Useful for pipelines that mandate Meshopt support.
     */
    requireExtensions?: boolean;
};

/**
 * Computes the number of quantization bits for positions given a bounding box
 * extent and an error tolerance.
 * 
 * @param extent - Axis-aligned extent of the mesh `{ x, y, z }`.
 * @param epsilon - Maximum tolerated spatial error (model units).
 * @returns The position bit depth clamped to **[8..16]**.
 */
const bitsFromEpsilon = (extent: { x: number, y: number, z: number }, epsilon: number): number => {
    const e = Math.max(1e-20, epsilon);
    const fx = Math.ceil(Math.log2(extent.x / (2 * e) + 1));
    const fy = Math.ceil(Math.log2(extent.y / (2 * e) + 1));
    const fz = Math.ceil(Math.log2(extent.z / (2 * e) + 1));
    return Math.max(8, Math.min(16, Math.max(fx, fy, fz)));
};

/**
 * Applies **KHR-style attribute quantization** and **EXT_meshopt_compression** to a glTF document.
 * 
 * @param doc - The glTF-Transform {@link Document} to transform.
 * @param opts - {@link QuantizeMeshoptOptions} controlling precision and extension requirements.
 * @param extent - Optional axis-aligned extent `{ x, y, z }` of the model, needed for epsilon-based bit inference.
 */
export const applyQuantizeAndMeshopt = async (
    doc: Document, 
    opts: QuantizeMeshoptOptions, 
    extent?: { x: number, y: number, z: number }
): Promise<void> => {
    let pos = opts.quantization?.positionBits ?? 15;
    const col = opts.quantization?.colorBits ?? 8;

    if(opts.epsilon && isFinite(opts.epsilon) && opts.epsilon > 0 && extent){
        pos = bitsFromEpsilon(extent, opts.epsilon);
    }

    await doc.transform(quantize({ quantizePosition: pos, quantizeColor: col }));
    await MeshoptEncoder.ready;

    doc.createExtension(EXTMeshoptCompression).setRequired(Boolean(opts.requireExtensions));
    await doc.transform(meshopt({ encoder: MeshoptEncoder }));
};

// Removed writeGLB - use writeGLBToBuffer instead

/**
 * Serializes a glTF {@link Document} to a GLB buffer in memory.
 *
 * @param doc - The glTF-Transform {@link Document} to serialize.
 * @returns Buffer containing the GLB binary data.
 */
export const writeGLBToBuffer = async (doc: Document): Promise<Buffer> => {
    const io = new NodeIO() 
        .registerExtensions([EXTMeshoptCompression])
        .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

    const arrayBuffer = await io.writeBinary(doc);
    return Buffer.from(arrayBuffer);
};