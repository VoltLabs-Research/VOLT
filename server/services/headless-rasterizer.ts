/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { createCanvas } from 'canvas';
import {
    Document,
    NodeIO,
    Primitive,
    Node as GNode,
} from '@gltf-transform/core';
import logger from '@/logger';
import { mat4, vec3, vec4 } from 'gl-matrix';

/**
 * 3D vertex with color.
 */
type Vertex3D = {
    x: number;
    y: number;
    z: number;
    c: [number, number, number];
};

/**
 * 3D triangle with three vertices.
 */
type Triangle3D = {
    a: Vertex3D;
    b: Vertex3D;
    c: Vertex3D;
};

interface StackItem {
    node: GNode;
    worldMatrix: mat4;
};

/**
 * 2D triangle (screen space) with average color and depth.
 */
type Tri2D = {
    a: { x: number, y: number },
    b: { x: number, y: number },
    c: { x: number, y: number },
    z: number,
    cAvg: [number, number, number]
};

/**
 * Options to configure the headless rasterizer.
 */
export interface HeadlessRasterizerOptions {
    /** Path to input GLTB/GLTF. */
    inputPath: string;
    /** Output PNG path. */
    /** Canvas width in pixels. */
    width: number;
    /** Canvas height in pixels. */
    height: number;
    /** Canvas background as CSS color or 'transparent'. */
    background: string;
    /** Vertical field of view (degress).  */
    fov: number;
    /** Maximum number of points to draw (point clouds). If '0' or less, all points are used. */
    maxPoints: number;
    /** Up axis, 'z' or anything else (defaults to a Y-up like behavior). */
    up: string;
    /** Azimuth angle in degress. */
    az: number;
    /** Elevation angle in degress. */
    el: number;
    /** Camera distance scaling factor. Useful to zoom out/in without changing FOV. */
    distScale: number;
}

/** Shared temporary 4x4 matrix. */
const TMP_MAT4 = mat4.create();

/**
 * Convert linear to sRGB. Clamps are applied elsewhere.
 * @param x - Linear color component.
 * @returns sRGB component.
 */
const lin2srgb = (x: number) => {
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
};

/**
 * Clamp into [0, 1].
 * @param x - Input value.
 */
const clamp01 = (x: number) => {
    return x < 0 ? 0 : x > 1 ? 1 : x;
};

/**
 * Clamp into [lo, hi]
 * @param x - Input value.
 * @param lo - Lower bound.
 * @param hi - Upper bound.
 */
const clamp = (x: number, lo = 0, hi = 1) => {
    return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Vector subtraction: out = a - b.
 */
const vsub = (a: [number, number, number], b: [number, number, number], out = [0, 0, 0] as [number, number, number]) => {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
};

/**
 * Dot product.
 */
const vdot = (a: [number, number, number], b: [number, number, number]) => {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

/**
 * Vector length.
 */
const vlen = (a: [number, number, number]) => {
    const x = a[0], y = a[1], z = a[2];
    return Math.sqrt(x * x + y * y + z * z) || 1;
};

/**
 * Normalize vector: out = a / |a|.
 */
const vnorm = (a: [number, number, number], out = [0, 0, 0] as [number, number, number]) => {
    const L = vlen(a);
    const invL = 1 / L;
    out[0] = a[0] * invL;
    out[1] = a[1] * invL;
    out[2] = a[2] * invL;
    return out;
};

/**
 * Cross product: out = a x b.
 */
const vcross = (a: [number, number, number], b: [number, number, number], out = [0, 0, 0] as [number, number, number]) => {
    const a0 = a[0], a1 = a[1], a2 = a[2];
    const b0 = b[0], b1 = b[1], b2 = b[2];
    out[0] = a1 * b2 - a2 * b1;
    out[1] = a2 * b0 - a0 * b2;
    out[2] = a0 * b1 - a1 * b0;
    return out;
};

/**
 * Multiply vector by scalar: out = c * s.
 */
const mul3 = (c: [number, number, number], s: number, out = [0, 0, 0] as [number, number, number]) => {
    out[0] = c[0] * s;
    out[1] = c[1] * s;
    out[2] = c[2] * s;
    return out;
};

/**
 * Add vectors: out = a + b.
 */
const add3 = (a: [number, number, number], b: [number, number, number], out = [0, 0, 0] as [number, number, number]) => {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
};

/**
 * ACES filmic tone mapping scalar.
 */
const aces = (x: number) => {
    const a = 2.51, b = 0.03, c = 2.33, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e));
};

/**
 * ACES tone mapping for RGB triplet.
 * @param c - Linear RGB in [0...inf)
 * @param out - Optional output vector.
 */
const toneMapACES = (c: [number, number, number], out = [0, 0, 0] as [number, number, number]) => {
    out[0] = aces(c[0]);
    out[1] = aces(c[1]);
    out[2] = aces(c[2]);
    return out;
};

/**
 * Convert linear RGB to CSS rgba string with small brightness boost.
 * @param rgb - Linear RGB [0...1].
 * @param alpha - Alpha [0...1].
 */
const colorToCSS = (rgb: [number, number, number], alpha = 1) => {
    const boost = 1.15;
    const r = Math.round(clamp01(lin2srgb(rgb[0] * boost)) * 255);
    const g = Math.round(clamp01(lin2srgb(rgb[1] * boost)) * 255);
    const b = Math.round(clamp01(lin2srgb(rgb[2] * boost)) * 255);
    return `rgba(${r},${g},${b},${clamp01(alpha)})`;
};

// Lighting configuration
const LIGHTS = {
    ambient: 0.22,
    key: {
        dir: vnorm([-0.6, -0.8, -0.2]),
        intensity: 1.25
    },
    fill: {
        dir: vnorm([0.8, 0.2, 0.35]),
        intensity: 0.50
    },
    rim: {
        intensity: 0.45,
        power: 2.25
    },
    shadow: {
        sizePx: 3.5,
        alpha: 0.28,
        softness: 0.5
    }
};

/**
 * Builds a local transform matrix for a node, honoring either its baked matrix or TRS.
 * @param node - glTF node.
 */
const nodeLocalMatrix = (node: GNode): mat4 => {
    const matrix = node.getMatrix();
    if (matrix) {
        return mat4.clone(matrix);
    }

    const translation = (node.getTranslation() ?? [0, 0, 0]);
    const rotation = (node.getRotation() ?? [0, 0, 0, 1]);
    const scale = (node.getScale() ?? [1, 1, 1]);

    mat4.fromRotationTranslationScale(TMP_MAT4, rotation, translation, scale);
    return mat4.clone(TMP_MAT4);
};

/**
 * Pushes transformed TRIANGLES from a primitive into `into`.
 * Handles TRIANGLES, STRIP and FAN with or without indices.
 */
const collectTrianglesFromPrimitive = (prim: Primitive, world: mat4, into: Triangle3D[]) => {
    // 4 = TRIANGLES, 5 = TRIANGLE_STRIP, 6 = TRIANGLE_FAN
    const mode = prim.getMode();

    const posAcc = prim.getAttribute('POSITION');
    if (!posAcc) return;

    const colAcc = prim.getAttribute('COLOR_0') ?? null;

    const posArr = posAcc.getArray() as Float32Array | number[];
    const count = posAcc.getCount();

    const colArr = colAcc ? (colAcc.getArray() as Float32Array | number[]) : null;
    const colSize = colAcc ? colAcc.getElementSize() : 0;

    // Pre-allocate temporary vectors for transformations
    const v = vec3.create();
    const colorTmp = [1, 1, 1] as [number, number, number];

    // color extraction
    const getColor = (i: number): [number, number, number] => {
        if (!colArr) return [1, 1, 1];

        let r = colArr[i * colSize] ?? 1;
        let g = colArr[i * colSize + 1] ?? 1;
        let b = colArr[i * colSize + 2] ?? 1;

        if (r > 1 || g > 1 || b > 1) {
            r /= 255;
            g /= 255;
            b /= 255;
        }

        // Enhance color saturation
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        const saturationBoost = 1.3;

        colorTmp[0] = clamp(r + (r - luminance) * saturationBoost, 0, 1);
        colorTmp[1] = clamp(g + (g - luminance) * saturationBoost, 0, 1);
        colorTmp[2] = clamp(b + (b - luminance) * saturationBoost, 0, 1);

        return [colorTmp[0], colorTmp[1], colorTmp[2]];
    };

    // Vertex creation with reusable vectors
    const mkV = (i: number): Vertex3D => {
        const idx = i * 3;
        vec3.set(v, posArr[idx], posArr[idx + 1], posArr[idx + 2]);
        vec3.transformMat4(v, v, world);
        const color = getColor(i);
        return {
            x: v[0],
            y: v[1],
            z: v[2],
            c: [color[0], color[1], color[2]]
        };
    };

    // Batch triangle creation for better memory performance
    const triangleBatch: Triangle3D[] = [];
    const pushTri = (i0: number, i1: number, i2: number) => {
        if (i0 >= count || i1 >= count || i2 >= count) return;
        triangleBatch.push({
            a: mkV(i0),
            b: mkV(i1),
            c: mkV(i2)
        });

        // Flush batch when it gets large enough
        if (triangleBatch.length >= 1024) {
            into.push(...triangleBatch);
            triangleBatch.length = 0;
        }
    };

    const TRIANGLES = (mode === undefined || mode === null || mode === 4);
    const STRIP = (mode === 5);
    const FAN = (mode === 6);

    const idxAcc = prim.getIndices();
    if (idxAcc) {
        const idx = idxAcc.getArray() as Uint16Array | Uint32Array | number[];

        if (TRIANGLES) {
            const idxLen = idx.length;
            for (let i = 0; i + 2 < idxLen; i += 3) {
                pushTri(idx[i], idx[i + 1], idx[i + 2]);
            }
        } else if (STRIP) {
            const idxLen = idx.length;
            for (let i = 0; i + 2 < idxLen; i++) {
                pushTri(idx[i], idx[i + 1], idx[i + 2]);
            }
        } else if (FAN) {
            const base = idx[0];
            const idxLen = idx.length;
            for (let i = 1; i + 1 < idxLen; i++) {
                pushTri(base, idx[i], idx[i + 1]);
            }
        }
    } else {
        if (TRIANGLES) {
            for (let i = 0; i + 2 < count; i += 3) {
                pushTri(i, i + 1, i + 2);
            }
        } else if (STRIP) {
            for (let i = 0; i + 2 < count; i++) {
                if (i % 2 === 0) {
                    pushTri(i, i + 1, i + 2);
                } else {
                    pushTri(i + 1, i, i + 2);
                }
            }
        } else if (FAN) {
            for (let i = 1; i + 1 < count; i++) {
                pushTri(0, i, i + 1);
            }
        }
    }

    // Push any remaining triangles
    if (triangleBatch.length > 0) {
        into.push(...triangleBatch);
    }
};

/**
 * Heuristic to decide if a node should be drawn as mesh (triangles) instead of points.
 * @param node - glTF node.
 */
const shouldRenderAsMesh = (node: GNode): boolean => {
    const names = new Set(['meshgeometry', 'dislocations']);
    const name = (node.getName() || '').toLowerCase();
    if (name && names.has(name)) return true;

    const mesh = node.getMesh();
    const meshName = (mesh?.getName() || '').toLowerCase();
    if (meshName && names.has(meshName)) return true;

    return false;
};

// TODO: experimental
const adaptivePointSize = (particleCount: number, width: number, height: number) => {
    if (particleCount <= 0) return 0.0;

    const pixels = width * height;
    const density = particleCount / pixels;

    if (density <= 0.25) return 4.0;
    if (density <= 1.0) return 3.0;
    if (density <= 3.0) return 2.0;
    if (density <= 6.0) return 1.5;
    return 1.0;
};

/**
 * Recorre el grafo de escena, acumula bounds en espacio mundial
 * y devuelve cuántos vértices "tipo punto" (no-mesh) hay en total.
 */
const computeBoundsAndCountForNode = (
    rootNode: GNode,
    parentWorld: mat4,
    min: [number, number, number],
    max: [number, number, number],
): number => {
    const stack: StackItem[] = [{
        node: rootNode,
        worldMatrix: mat4.clone(parentWorld)
    }];

    const tmp = vec3.create();
    let countTotal = 0;

    while (stack.length > 0) {
        const { node, worldMatrix } = stack.pop()!;
        const local = nodeLocalMatrix(node);
        const world = mat4.create();
        mat4.multiply(world, worldMatrix, local);

        const mesh = node.getMesh();
        if (mesh) {
            const primitives = mesh.listPrimitives();
            const asMesh = shouldRenderAsMesh(node);

            for (let p = 0; p < primitives.length; p++) {
                const prim = primitives[p];
                const posAcc = prim.getAttribute('POSITION');
                if (!posAcc) continue;

                const posArr = posAcc.getArray() as Float32Array | number[];
                const count = posAcc.getCount();

                if (!asMesh) {
                    countTotal += count;
                }

                for (let i = 0; i < count; i++) {
                    const idx = i * 3;
                    vec3.set(
                        tmp,
                        (posArr as any)[idx],
                        (posArr as any)[idx + 1],
                        (posArr as any)[idx + 2]
                    );
                    vec3.transformMat4(tmp, tmp, world);

                    if (tmp[0] < min[0]) min[0] = tmp[0];
                    if (tmp[1] < min[1]) min[1] = tmp[1];
                    if (tmp[2] < min[2]) min[2] = tmp[2];

                    if (tmp[0] > max[0]) max[0] = tmp[0];
                    if (tmp[1] > max[1]) max[1] = tmp[1];
                    if (tmp[2] > max[2]) max[2] = tmp[2];
                }
            }
        }

        const children = node.listChildren();
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push({
                node: children[i],
                worldMatrix: mat4.clone(world)
            });
        }
    }

    return countTotal;
};

const rasterizePointsForNode = (
    rootNode: GNode,
    parentWorld: mat4,
    vp: mat4,
    width: number,
    height: number,
    depthBuffer: Float32Array,
    colorBuffer: Uint8ClampedArray,
    pointRadius: number,
) => {
    if (pointRadius <= 0) return;

    const stack: StackItem[] = [{
        node: rootNode,
        worldMatrix: mat4.clone(parentWorld)
    }];

    const tmp3 = vec3.create();
    const tmp4 = vec4.create();

    const r = Math.max(1, pointRadius | 0);
    const r2 = r * r;

    const halfW = width * 0.5;
    const halfH = height * 0.5;

    const buf32 = new Uint32Array(colorBuffer.buffer);

    const packRGBA = (R: number, G: number, B: number, A: number) => {
        // Little endian: [R, G, B, A]
        return (A << 24) | (B << 16) | (G << 8) | (R);
    };

    while (stack.length > 0) {
        const { node, worldMatrix } = stack.pop()!;
        const local = nodeLocalMatrix(node);
        const world = mat4.create();
        mat4.multiply(world, worldMatrix, local);

        const mesh = node.getMesh();
        if (mesh) {
            const asMesh = shouldRenderAsMesh(node);
            if (!asMesh) {
                const primitives = mesh.listPrimitives();
                for (let p = 0; p < primitives.length; p++) {
                    const prim = primitives[p];

                    const posAcc = prim.getAttribute('POSITION');
                    if (!posAcc) continue;

                    const colAcc = prim.getAttribute('COLOR_0') ?? null;

                    const posArr = posAcc.getArray() as Float32Array | number[];
                    const count = posAcc.getCount();
                    const colArr = colAcc ? (colAcc.getArray() as Float32Array | number[]) : null;
                    const colSize = colAcc ? colAcc.getElementSize() : 0;

                    for (let i = 0; i < count; i++) {
                        const idx = i * 3;

                        vec3.set(
                            tmp3,
                            (posArr as any)[idx],
                            (posArr as any)[idx + 1],
                            (posArr as any)[idx + 2]
                        );
                        vec3.transformMat4(tmp3, tmp3, world);

                        vec4.set(tmp4, tmp3[0], tmp3[1], tmp3[2], 1.0);
                        vec4.transformMat4(tmp4, tmp4, vp);

                        const w = tmp4[3];
                        if (w === 0) continue;

                        const invW = 1 / w;
                        const ndcX = tmp4[0] * invW;
                        const ndcY = tmp4[1] * invW;
                        const ndcZ = tmp4[2] * invW;

                        if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1 || ndcZ < -1 || ndcZ > 1) {
                            continue;
                        }

                        const px = ndcX * halfW + halfW;
                        const py = -ndcY * halfH + halfH;

                        const ix = px | 0;
                        const iy = py | 0;

                        if (ix < 0 || ix >= width || iy < 0 || iy >= height) continue;

                        const depth = (ndcZ + 1) * 0.5;

                        let rCol = 1, gCol = 1, bCol = 1;
                        if (colArr) {
                            const base = i * colSize;
                            rCol = (colArr as any)[base] ?? 1;
                            gCol = (colArr as any)[base + 1] ?? 1;
                            bCol = (colArr as any)[base + 2] ?? 1;

                            if (rCol > 1 || gCol > 1 || bCol > 1) {
                                rCol *= 1 / 255;
                                gCol *= 1 / 255;
                                bCol *= 1 / 255;
                            }

                            const luminance = 0.299 * rCol + 0.587 * gCol + 0.114 * bCol;
                            const saturationBoost = 1.3;
                            rCol = clamp(rCol + (rCol - luminance) * saturationBoost, 0, 1);
                            gCol = clamp(gCol + (gCol - luminance) * saturationBoost, 0, 1);
                            bCol = clamp(bCol + (bCol - luminance) * saturationBoost, 0, 1);
                        }

                        const boost = 1.15;
                        const R = Math.round(clamp01(lin2srgb(rCol * boost)) * 255);
                        const G = Math.round(clamp01(lin2srgb(gCol * boost)) * 255);
                        const B = Math.round(clamp01(lin2srgb(bCol * boost)) * 255);
                        const packed = packRGBA(R, G, B, 255);

                        const centerIndex = iy * width + ix;

                        if (r === 1) {
                            if (depth < depthBuffer[centerIndex]) {
                                depthBuffer[centerIndex] = depth;
                                buf32[centerIndex] = packed;
                            }
                            continue;
                        }

                        for (let dy = -r; dy <= r; dy++) {
                            const yy = iy + dy;
                            if (yy < 0 || yy >= height) continue;

                            const rowIndex = yy * width;

                            for (let dx = -r; dx <= r; dx++) {
                                const xx = ix + dx;
                                if (xx < 0 || xx >= width) continue;

                                if (dx * dx + dy * dy > r2) continue;

                                const index = rowIndex + xx;

                                if (depth >= depthBuffer[index]) continue;
                                depthBuffer[index] = depth;
                                buf32[index] = packed;
                            }
                        }
                    }
                }
            }
        }

        const children = node.listChildren();
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push({ node: children[i], worldMatrix: mat4.clone(world) });
        }
    }
};

const collectMeshTriangles = (
    rootNode: GNode,
    parentWorld: mat4,
    trisOut: Triangle3D[],
) => {
    const stack: StackItem[] = [{
        node: rootNode,
        worldMatrix: mat4.clone(parentWorld)
    }];

    while (stack.length > 0) {
        const { node, worldMatrix } = stack.pop()!;
        const local = nodeLocalMatrix(node);
        const world = mat4.create();
        mat4.multiply(world, worldMatrix, local);

        const mesh = node.getMesh();
        if (mesh && shouldRenderAsMesh(node)) {
            const primitives = mesh.listPrimitives();
            for (let i = 0; i < primitives.length; i++) {
                const prim = primitives[i];
                collectTrianglesFromPrimitive(prim, world, trisOut);
            }
        }

        const children = node.listChildren();
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push({ node: children[i], worldMatrix: mat4.clone(world) });
        }
    }
};

/**
 * Headless GLB/GLTF rasterizer that renders points and selected meshes into a PNG.
 * Points are drawn with AO and simple lighting hints. Triangles are drawn with a tri-light rig 
 * (ambient, key, fill, rim) and screen-projected shadows and traverses all scenes in the document.
 * @public
 */
class HeadlessRasterizer {
    private opts: HeadlessRasterizerOptions;

    /**
     * Create a new rasterizer instance.
     * @param opts - Configuration options.
     */
    constructor(opts: HeadlessRasterizerOptions) {
        this.opts = {
            inputPath: opts.inputPath,
            width: opts?.width ?? 1600,
            height: opts?.height ?? 900,
            background: opts.background ?? 'transparent',
            fov: opts.fov ?? 45,
            maxPoints: opts.maxPoints ?? 0,
            up: opts.up ?? 'z',
            az: opts.az ?? 45,
            el: opts.el ?? 25,
            distScale: opts.distScale ?? 1.0,
        };
    }

    /**
     * Create a NodeIO and register meshopt decoder/extension when available.
     */
    private async makeIOWithCodecs(): Promise<NodeIO> {
        const io = new NodeIO();

        if (EXTMeshoptCompression && MeshoptDecoder) {
            await MeshoptDecoder.ready;
            io.registerExtensions([EXTMeshoptCompression])
                .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
        }

        return io;
    }

    /**
     * Load a glTF document from disk.
     * @throws If the GLTF/GLB cannot be read.
     */
    private async loadDocument(): Promise<Document> {
        const io = await this.makeIOWithCodecs();
        try {
            return await io.read(this.opts.inputPath);
        } catch (err: any) {
            logger.error(err);
            throw err;
        }
    }

    /**
     * Render the input GLB/GLTF into a PNG at `opts.outputPath`.
     * @throws If no scenes/geometry found, or bounds/projection fails.
     */
    /**
 * Render del GLB/GLTF a PNG.
 * - Átomos (nodos no-mesh): z-buffer por punto con discos de radio adaptativo.
 * - Meshes (meshgeometry, dislocations, etc.): triángulos con luces/sombras como antes.
 */
    public async render(): Promise<Buffer> {
        const document = await this.loadDocument();
        const root = document.getRoot();
        const scenes = root.listScenes();
        if (!scenes.length) {
            throw new Error('GLB_WITHOUT_SCENES');
        }

        const width = this.opts.width;
        const height = this.opts.height;

        const min: [number, number, number] = [Infinity, Infinity, Infinity];
        const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
        let totalPoints = 0;

        for (const scene of scenes) {
            for (const node of scene.listChildren()) {
                totalPoints += computeBoundsAndCountForNode(node, mat4.create(), min, max);
            }
        }

        if (
            !isFinite(min[0]) || !isFinite(min[1]) || !isFinite(min[2]) ||
            !isFinite(max[0]) || !isFinite(max[1]) || !isFinite(max[2])
        ) {
            throw new Error('FAILED_BOUNDS_COMPUTATION');
        }

        const cx = (min[0] + max[0]) * 0.5;
        const cy = (min[1] + max[1]) * 0.5;
        const cz = (min[2] + max[2]) * 0.5;

        const dx = max[0] - min[0];
        const dy = max[1] - min[1];
        const dz = max[2] - min[2];
        const r = 0.5 * Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (!isFinite(r) || r <= 0) {
            throw new Error('INVALID_RADIUS');
        }

        const aspect = width / height;
        const fovRad = (this.opts.fov * Math.PI) / 180;
        const fovH = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);

        let distance = 1.2 * Math.max(
            r / Math.tan(fovRad / 2),
            r / Math.tan(fovH / 2)
        );
        distance = Math.max(
            1e-3,
            distance * (isFinite(this.opts.distScale) ? this.opts.distScale : 1.0)
        );

        const near = Math.max(1e-3, distance - r * 2);
        const far = distance + r * 2;

        const azRad = (this.opts.az * Math.PI) / 180;
        const elRad = (this.opts.el * Math.PI) / 180;

        let dirX = 0, dirY = 0, dirZ = 0;
        const isZUp = this.opts.up === 'z';

        if (isZUp) {
            dirX = Math.cos(elRad) * Math.cos(azRad);
            dirY = Math.cos(elRad) * Math.sin(azRad);
            dirZ = Math.sin(elRad);
        } else {
            dirX = Math.cos(elRad) * Math.cos(azRad);
            dirY = Math.sin(elRad);
            dirZ = Math.cos(elRad) * Math.sin(azRad);
        }

        const L = Math.hypot(dirX, dirY, dirZ) || 1;
        dirX /= L;
        dirY /= L;
        dirZ /= L;

        const eye = vec3.fromValues(cx + dirX * distance, cy + dirY * distance, cz + dirZ * distance);
        const center = vec3.fromValues(cx, cy, cz);
        const upVec = isZUp ? vec3.fromValues(0, 0, 1) : vec3.fromValues(0, 1, 0);

        const view = mat4.create();
        mat4.lookAt(view, eye, center, upVec);

        const proj = mat4.create();
        mat4.perspective(proj, fovRad, aspect, near, far);

        const vp = mat4.create();
        mat4.multiply(vp, proj, view);

        const lightKeyView = (() => {
            const v = vec4.fromValues(LIGHTS.key.dir[0], LIGHTS.key.dir[1], LIGHTS.key.dir[2], 0);
            vec4.transformMat4(v, v, view);
            return vnorm([v[0], v[1], v[2]]);
        })();

        const tris: Triangle3D[] = [];
        for (const scene of scenes) {
            for (const node of scene.listChildren()) {
                collectMeshTriangles(node, mat4.create(), tris);
            }
        }

        if (totalPoints === 0 && tris.length === 0) {
            throw new Error('NO_GEOMETRY');
        }

        const depthBuffer = new Float32Array(width * height);
        depthBuffer.fill(Number.POSITIVE_INFINITY);

        const colorBuffer = new Uint8ClampedArray(width * height * 4);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        let bgColor: Uint8ClampedArray | null = null;

        if (this.opts.background !== 'transparent') {
            ctx.fillStyle = this.opts.background;
            ctx.fillRect(0, 0, width, height);

            const bgPixel = ctx.getImageData(0, 0, 1, 1).data;
            bgColor = new Uint8ClampedArray([bgPixel[0], bgPixel[1], bgPixel[2], bgPixel[3]]);

            const totalPixels = width * height;
            for (let i = 0, o = 0; i < totalPixels; i++, o += 4) {
                colorBuffer[o + 0] = bgColor[0];
                colorBuffer[o + 1] = bgColor[1];
                colorBuffer[o + 2] = bgColor[2];
                colorBuffer[o + 3] = bgColor[3];
            }
        }

        const pointRadius = adaptivePointSize(totalPoints, width, height);
        const intRadius = Math.max(1, Math.round(pointRadius));

        if (totalPoints > 0 && pointRadius > 0) {
            for (const scene of scenes) {
                for (const node of scene.listChildren()) {
                    rasterizePointsForNode(
                        node,
                        mat4.create(),
                        vp,
                        width,
                        height,
                        depthBuffer,
                        colorBuffer,
                        intRadius,
                    );
                }
            }
        }

        /*let anyHit = false;
        for (let i = 0; i < depthBuffer.length; i++){
            if (depthBuffer[i] !== Number.POSITIVE_INFINITY) {
                anyHit = true;
                break;
            }
        }*/

        const imageData = ctx.createImageData(width, height);
        imageData.data.set(colorBuffer);
        ctx.putImageData(imageData, 0, 0);

        type Tri2DPlus = Tri2D & { tri3D: Triangle3D };

        const v4 = vec4.create();
        const projV = (x: number, y: number, z: number) => {
            vec4.set(v4, x, y, z, 1.0);
            vec4.transformMat4(v4, v4, vp);

            const w = v4[3];
            if (w === 0) return null;

            const invW = 1 / w;
            const ndcX = v4[0] * invW;
            const ndcY = v4[1] * invW;
            const ndcZ = v4[2] * invW;

            if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1 || ndcZ < -1 || ndcZ > 1) return null;

            return {
                sx: (ndcX * 0.5 + 0.5) * width,
                sy: (1 - (ndcY * 0.5 + 0.5)) * height,
                z: ndcZ,
            };
        };

        const outTris2D: Tri2DPlus[] = [];
        const TRIANGLE_BATCH_SIZE = 512;

        for (let batchStart = 0; batchStart < tris.length; batchStart += TRIANGLE_BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + TRIANGLE_BATCH_SIZE, tris.length);

            for (let i = batchStart; i < batchEnd; i++) {
                const triangle = tris[i];

                const A = projV(triangle.a.x, triangle.a.y, triangle.a.z);
                const B = projV(triangle.b.x, triangle.b.y, triangle.b.z);
                const C = projV(triangle.c.x, triangle.c.y, triangle.c.z);

                if (!A || !B || !C) continue;

                // Backface culling
                const abx = B.sx - A.sx;
                const aby = B.sy - A.sy;
                const acx = C.sx - A.sx;
                const acy = C.sy - A.sy;
                const cross = abx * acy - aby * acx;
                if (cross >= 0) continue;

                const zAvg = (A.z + B.z + C.z) / 3;
                const cAvg: [number, number, number] = [
                    (triangle.a.c[0] + triangle.b.c[0] + triangle.c.c[0]) / 3,
                    (triangle.a.c[1] + triangle.b.c[1] + triangle.c.c[1]) / 3,
                    (triangle.a.c[2] + triangle.b.c[2] + triangle.c.c[2]) / 3,
                ];

                outTris2D.push({
                    a: { x: A.sx, y: A.sy },
                    b: { x: B.sx, y: B.sy },
                    c: { x: C.sx, y: C.sy },
                    z: zAvg,
                    cAvg,
                    tri3D: triangle,
                });
            }
        }

        if (outTris2D.length > 5000) {
            const indices = new Uint32Array(outTris2D.length);
            for (let i = 0; i < indices.length; i++) indices[i] = i;
            indices.sort((a, b) => outTris2D[b].z - outTris2D[a].z);
            const sorted: Tri2DPlus[] = new Array(outTris2D.length);
            for (let i = 0; i < indices.length; i++) sorted[i] = outTris2D[indices[i]];
            for (let i = 0; i < sorted.length; i++) outTris2D[i] = sorted[i];
        } else {
            outTris2D.sort((a, b) => b.z - a.z);
        }

        // Shading
        const tmpVA = [0, 0, 0] as [number, number, number];
        const tmpVB = [0, 0, 0] as [number, number, number];
        const tmpVC = [0, 0, 0] as [number, number, number];
        const tmpCenter = [0, 0, 0] as [number, number, number];
        const tmpN = [0, 0, 0] as [number, number, number];
        const tmpVdir = [0, 0, 0] as [number, number, number];
        const tmpCol = [0, 0, 0] as [number, number, number];

        const shadeTriangle = (t: Triangle3D, base: [number, number, number]) => {
            tmpVA[0] = t.a.x; tmpVA[1] = t.a.y; tmpVA[2] = t.a.z;
            tmpVB[0] = t.b.x; tmpVB[1] = t.b.y; tmpVB[2] = t.b.z;
            tmpVC[0] = t.c.x; tmpVC[1] = t.c.y; tmpVC[2] = t.c.z;

            tmpCenter[0] = (tmpVA[0] + tmpVB[0] + tmpVC[0]) / 3;
            tmpCenter[1] = (tmpVA[1] + tmpVB[1] + tmpVC[1]) / 3;
            tmpCenter[2] = (tmpVA[2] + tmpVB[2] + tmpVC[2]) / 3;

            const vab = vsub(tmpVB, tmpVA, [0, 0, 0] as [number, number, number]);
            const vac = vsub(tmpVC, tmpVA, [0, 0, 0] as [number, number, number]);
            vcross(vab, vac, tmpN);
            vnorm(tmpN, tmpN);

            tmpVdir[0] = tmpCenter[0] - eye[0];
            tmpVdir[1] = tmpCenter[1] - eye[1];
            tmpVdir[2] = tmpCenter[2] - eye[2];
            vnorm(tmpVdir, tmpVdir);

            const negKeyDir = mul3(LIGHTS.key.dir, -1, [0, 0, 0] as [number, number, number]);
            const negFillDir = mul3(LIGHTS.fill.dir, -1, [0, 0, 0] as [number, number, number]);

            const ndl_key = Math.pow(clamp(vdot(tmpN, negKeyDir)), 0.8);
            const ndl_fill = Math.pow(clamp(vdot(tmpN, negFillDir)), 0.8);

            mul3(base, LIGHTS.ambient, tmpCol);

            const keyContrib = mul3(base, LIGHTS.key.intensity * ndl_key, [0, 0, 0] as [number, number, number]);
            add3(tmpCol, keyContrib, tmpCol);

            const fillContrib = mul3(base, LIGHTS.fill.intensity * ndl_fill, [0, 0, 0] as [number, number, number]);
            add3(tmpCol, fillContrib, tmpCol);

            const rim = Math.pow(clamp(1 - Math.abs(vdot(tmpN, tmpVdir))), LIGHTS.rim.power) * LIGHTS.rim.intensity;
            const rimContrib = mul3([1, 1, 1], rim, [0, 0, 0] as [number, number, number]);
            add3(tmpCol, rimContrib, tmpCol);

            toneMapACES(tmpCol, tmpCol);
            tmpCol[0] = clamp(tmpCol[0]);
            tmpCol[1] = clamp(tmpCol[1]);
            tmpCol[2] = clamp(tmpCol[2]);

            return [tmpCol[0], tmpCol[1], tmpCol[2]] as [number, number, number];
        };

        const screenShadowOffset = (() => {
            let sx = lightKeyView[0];
            let sy = -lightKeyView[1];
            const Ls = Math.hypot(sx, sy) || 1;
            sx /= Ls;
            sy /= Ls;
            return [sx * LIGHTS.shadow.sizePx, sy * LIGHTS.shadow.sizePx] as [number, number];
        })();

        const shadowStyle1 = colorToCSS([0, 0, 0], LIGHTS.shadow.alpha * 0.7);
        const shadowStyle2 = colorToCSS([0, 0, 0], LIGHTS.shadow.alpha);

        const drawTriangle = (ctx: CanvasRenderingContext2D, t: Tri2D, offsetX = 0, offsetY = 0) => {
            ctx.beginPath();
            ctx.moveTo(t.a.x + offsetX, t.a.y + offsetY);
            ctx.lineTo(t.b.x + offsetX, t.b.y + offsetY);
            ctx.lineTo(t.c.x + offsetX, t.c.y + offsetY);
            ctx.closePath();
        };

        const [ox, oy] = screenShadowOffset;

        for (let i = 0; i < outTris2D.length; i++) {
            const t2 = outTris2D[i];
            const shaded = shadeTriangle(t2.tri3D, t2.cAvg);

            if (LIGHTS.shadow.softness > 0) {
                ctx.fillStyle = shadowStyle1;
                // @ts-ignore
                drawTriangle(ctx, t2, ox * 1.2, oy * 1.2);
                ctx.fill();
            }

            ctx.fillStyle = shadowStyle2;
            // @ts-ignore
            drawTriangle(ctx, t2, ox, oy);
            ctx.fill();

            ctx.fillStyle = colorToCSS(shaded, 1);
            // @ts-ignore
            drawTriangle(ctx, t2);
            ctx.fill();
        }

        return new Promise<Buffer>(async (resolve, reject) => {
            const pngStream = canvas.createPNGStream();
            const chunks: Buffer[] = [];

            pngStream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            })

            pngStream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            pngStream.on('error', reject);
        });
    }
}

export default HeadlessRasterizer;