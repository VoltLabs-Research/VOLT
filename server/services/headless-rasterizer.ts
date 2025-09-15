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

import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { createCanvas } from 'canvas';
import { NodeIO, type Document, type Primitive, type Node as GNode } from '@gltf-transform/core';
import { mat4, vec3, vec4 } from 'gl-matrix';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'path';

type Point = { 
    x: number; 
    y: number; 
    z: number; 
    c: [number, number, number] 
};

type P2D = {
    sx: number;
    sy: number;
    z: number;
    c: [number, number, number]
};

type Vertex3D = {
    x: number;
    y: number;
    z: number;
    c: [number, number, number];
};

type Triangle3D = {
    a: Vertex3D;
    b: Vertex3D;
    c: Vertex3D;
};

type Tri2D = {
    a: { x: number, y: number },
    b: { x: number, y: number },
    c: { x: number, y: number },
    z: number,
    cAvg: [number, number, number]
};

export interface HeadlessRasterizerOptions{
    inputPath: string;
    outputPath: string;
    width: number;
    height: number;
    background: string;
    fov: number;
    pointSize: number;
    maxPoints: number;
    up: string;
    az: number;
    el: number;
    distScale: number;
}

const lin2srgb = (x: number) => {
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
};

const clamp01 = (x: number) => {
    return Math.min(1, Math.max(0, x));
};

const clamp = (x: number, lo = 0, hi = 1) => {
    return Math.min(hi, Math.max(lo, x));
}

const vsub = (a: [number, number, number], b: [number, number, number]) => {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as [number, number, number];
};

const vdot = (a: [number, number, number], b: [number, number, number]) => {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

const vlen = (a: [number, number, number]) => {
    return Math.hypot(a[0], a[1], a[2]) || 1;
};

const vnorm = (a: [number, number, number]) => {
    const L = vlen(a);
    return [a[0] / L, a[1] / L, a[2] / L] as [number, number, number];
};

const vcross = (a: [number, number, number], b: [number, number, number]) => {
    return [
        a[1] * b[2] - a[2] * b[1], a[2] * b[0]- a[0] * b[2], a[0] * b[1] - a[1] * b[0]
    ] as [number, number, number];
};

const mul3 = (c: [number, number, number], s :number) => {
    return [c[0] * s, c[1] * s, c[2] * s] as [number, number, number];
};

const add3 = (a: [number, number, number], b: [number, number, number]) => {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as [number, number, number];
};

const aces = (x: number) => {
    const a = 2.51;
    const b = 0.03;
    const c = 2.43;
    const d = 0.59;
    const e = 0.14;

    return clamp((x * (a * x + b)) / (x * (c * x + d) + e));
};

const toneMapACES = (c: [number, number, number]) => {
    return [aces(c[0]), aces(c[1]), aces(c[2])] as [number, number, number];
};

const colorToCSS = (rgb: [number, number, number], alpha = 1) => {
    const [r, g, b] = rgb;
    const R = Math.round(clamp01(lin2srgb(r)) * 255);
    const G = Math.round(clamp01(lin2srgb(g)) * 255);
    const B = Math.round(clamp01(lin2srgb(b)) * 255);
    return `rgba(${R},${G},${B},${clamp01(alpha)})`;
};

const LIGHTS = {
    ambient: 0.28,
    key: {
        dir: vnorm([-0.6, -0.8, -0.2]),
        intensity: 1.15
    },
    fill: {
        dir: vnorm([ 0.8,  0.2,  0.35]),
        intensity: 0.45
    },
    rim: {
        intensity: 0.35,
        power: 2.0
    },
    shadow: {
        sizePx: 3,
        alpha: 0.22
    }
};

const nodeLocalMatrix = (node: GNode): mat4 => {
    const matrix = node.getMatrix();
    if(matrix){
        return mat4.clone(matrix);
    }

    const translation = (node.getTranslation() ?? [0, 0, 0]);
    const rotation = (node.getRotation() ?? [0, 0, 0, 1]);
    const scale = (node.getScale() ?? [1, 1, 1]);

    const out = mat4.create();
    return mat4.fromRotationTranslationScale(out, rotation, translation, scale);
};

const collectPointsFromPrimitive = (prim: Primitive, world: mat4, into: Point[]) => {
    const posAcc = prim.getAttribute('POSITION'); if (!posAcc) return;
    const colAcc = prim.getAttribute('COLOR_0') ?? null;

    const posArr = posAcc.getArray() as Float32Array | number[];
    const count = posAcc.getCount();
    const colArr = colAcc ? (colAcc.getArray() as Float32Array | number[]) : null;
    const colSize = colAcc ? colAcc.getElementSize() : 0;

    const tmp = vec3.create();
    for(let i = 0; i < count; i++){
        const x = (posArr as any)[i * 3 + 0];
        const y = (posArr as any)[i * 3 + 1];
        const z = (posArr as any)[i * 3 + 2];
        vec3.set(tmp, x, y, z);
        vec3.transformMat4(tmp, tmp, world);
        
        let r = 1, g = 1, b = 1;
        if(colArr){
            const base = i * colSize;
            r = (colArr as any)[base + 0] ?? 1;
            g = (colArr as any)[base + 1] ?? 1;
            b = (colArr as any)[base + 2] ?? 1;
            if(r > 1 || g > 1 || b > 1){
                r /= 255; 
                g /= 255;
                b /= 255; 
            }
        }

        into.push({ x: tmp[0], y: tmp[1], z: tmp[2], c: [r, g, b] });
    }
};

const collectTrianglesFromPrimitive = (prim: Primitive, world: mat4, into: Triangle3D[]) => {
    // 4 = TRIANGLES, 5 = TRIANGLE_STRIP, 6 = TRIANGLE_FAN
    const mode = prim.getMode();

    const posAcc = prim.getAttribute('POSITION');
    if(!posAcc) return;

    const colAcc = prim.getAttribute('COLOR_0') ?? null;

    const posArr = posAcc.getArray() as Float32Array | number[];
    const count = posAcc.getCount();

    const colArr = colAcc ? (colAcc.getArray() as Float32Array | number[]) : null;
    const colSize = colAcc ? colAcc.getElementSize() : 0;

    const getColor = (i: number): [number, number, number] => {
        if(!colArr) return [1, 1, 1];
        let r = colArr[i * colSize + 0] ?? 1;
        let g = colArr[i * colSize + 1] ?? 1;
        let b = colArr[i * colSize + 2] ?? 1;
        if(r > 1 || g > 1 || b > 1){
            r /= 255; 
            g /= 255; 
            b /= 255; 
        }
        return [r, g, b];
    };

    const mkV = (i: number): Vertex3D => {
        const x = posArr[i * 3 + 0];
        const y = posArr[i * 3 + 1];
        const z = posArr[i * 3 + 2];
        const v = vec3.fromValues(x, y, z);
        vec3.transformMat4(v, v, world);
        return { x: v[0], y: v[1], z: v[2], c: getColor(i) };
    };

    const pushTri = (i0: number, i1: number, i2: number) => {
        if(i0 >= count || i1 >= count || i2 >= count) return;
        into.push({ a: mkV(i0), b: mkV(i1), c: mkV(i2) });
    };

    const TRIANGLES = (mode === undefined || mode === null || mode === 4);
    const STRIP = (mode === 5);
    const FAN = (mode === 6);

    const idxAcc = prim.getIndices();
    if(idxAcc){
        const idx = idxAcc.getArray() as Uint16Array | Uint32Array | number[];
        if(TRIANGLES){
            for(let i = 0; i + 2 < idx.length; i += 3){
                pushTri(idx[i], idx[i + 1], idx[i + 2]);
            }
        }else if(STRIP){
            for(let i = 0; i + 2 < idx.length; i++){
                const i0 = idx[i];
                const i1 = idx[i + 1];
                const i2 = idx[i + 2];
                if(i % 2 === 0){
                    pushTri(i0, i1, i2);
                }else{
                    pushTri(i1, i0, i2);
                }
            }
        }else if(FAN){
            const base = idx[0];
            for(let i = 1; i + 1 < idx.length; i++){
                pushTri(base, idx[i], idx[i + 1]);
            }
        }
    }else{
        if(TRIANGLES){
            for(let i = 0; i + 2 < count; i += 3){
                pushTri(i, i + 1, i + 2);
            }
        }else if(STRIP){
            for(let i = 0; i + 2 < count; i++){
                if(i % 2 === 0){
                    pushTri(i, i + 1, i + 2);
                }else{
                    pushTri(i + 1, i, i + 2);
                }
            }
        }else if(FAN){
            for(let i = 1; i + 1 < count; i++){
                pushTri(0, i, i + 1);
            }
        }
    }
};

const shouldRenderAsMesh = (node: GNode): boolean => {
    const names = new Set(['meshgeometry', 'dislocations']);
    const name = (node.getName() || '').toLowerCase();
    if(name && names.has(name)) return true;

    const mesh = node.getMesh();
    const meshName = (mesh?.getName() || '').toLowerCase();
    if(meshName && names.has(meshName)) return true;

    return false;
};

const traverseCollectPoints = (node: GNode, parentWorld: mat4, pointsOut: Point[], trisOut: Triangle3D[]) => {
    const local = nodeLocalMatrix(node);
    const world = mat4.create();
    mat4.multiply(world, parentWorld, local);

    const asMesh = shouldRenderAsMesh(node);
    const mesh = node.getMesh();
    if(mesh){
        for(const prim of mesh.listPrimitives()){
            if(asMesh){
                collectTrianglesFromPrimitive(prim, world, trisOut);
            }else{
                collectPointsFromPrimitive(prim, world, pointsOut);
            }
        }
    }

    for(const child of node.listChildren()){
        traverseCollectPoints(child, world, pointsOut, trisOut);
    } 
};

const reservoirSample = <T>(arr: T[], k: number): T[] => {
    if(k <= 0 || k >= arr.length){
        return arr.slice();
    }

    const res = arr.slice(0, k);
    for(let i = k; i < arr.length; i++){
        const j = Math.floor(Math.random() * (i + 1));
        if(j < k) res[j] = arr[i];
    }

    return res;
};

class HeadlessRasterizer{
    private opts: HeadlessRasterizerOptions;

    constructor(opts: HeadlessRasterizerOptions){
        this.opts = {
            inputPath: opts?.inputPath,
            outputPath: opts?.outputPath,
            width: opts?.width ?? 1600,
            height: opts?.height ?? 900,
            background: opts.background ?? 'transparent',
            fov: opts.fov ?? 45,
            pointSize: opts.pointSize ?? 2.0,
            maxPoints: opts.maxPoints ?? 0,
            up: opts.up ?? 'z',
            az: opts.az ?? 45,
            el: opts.el ?? 25,
            distScale: opts.distScale ?? 1.0
        };
    }

    private async makeIOWithCodecs(): Promise<NodeIO>{
        const io = new NodeIO();

        if(EXTMeshoptCompression && MeshoptDecoder){
            await MeshoptDecoder.ready;
            io.registerExtensions([ EXTMeshoptCompression ])
                .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
        }

        return io;
    }

    private async loadDocument(): Promise<Document>{
        const io = await this.makeIOWithCodecs();
        try{
            return await io.read(this.opts.inputPath);
        }catch(err: any){
            console.error(err);
            throw err;
        }
    }

    public async render(){
        const document = await this.loadDocument();
        const root = document.getRoot();
        const scenes = root.listScenes();
        if(!scenes.length) throw new Error('GLB_WITHOUT_SCENES');

        const points: Point[] = [];
        const tris: Triangle3D[] = [];
        for(const scene of scenes){
            for(const node of scene.listChildren()){
                traverseCollectPoints(node, mat4.create(), points, tris);
            }
        }

        if(points.length === 0 && tris.length === 0) throw new Error('NO_GEOMETRY');

        const { maxPoints } = this.opts;
        const usePoints = (maxPoints > 0 && points.length > maxPoints) ? reservoirSample(points, maxPoints) : points;

        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        const expand = (x: number, y: number, z: number) => {
            if(x < minX) minX = x; 
            if(y < minY) minY = y; 
            if(z < minZ) minZ = z;
            if(x > maxX) maxX = x; 
            if(y > maxY) maxY = y; 
            if(z > maxZ) maxZ = z;
        };

        for(const point of usePoints){
            expand(point.x, point.y, point.z);
        }

        for(const triangle of tris){
            expand(triangle.a.x, triangle.a.y, triangle.a.z);
            expand(triangle.b.x, triangle.b.y, triangle.b.z);
            expand(triangle.c.x, triangle.c.y, triangle.c.z);
        }

        if(!isFinite(minX) || !isFinite(minY) || !isFinite(minZ) || !isFinite(maxX) || !isFinite(maxY) || !isFinite(maxZ)){
            throw new Error('FAILED_BOUNDS_COMPUTATION');
        } 

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2
        const cz = (minZ + maxZ) / 2;

        let r = 0;
        const updR = (x: number, y: number, z: number) => {
            const dx= x - cx;
            const dy= y - cy;
            const dz= z - cz; 
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz); 
            if(d > r) r=d;
        };

        // TODO: again?
        for(const p of usePoints){
            updR(p.x, p.y, p.z);
        }

        for(const t of tris){
            updR(t.a.x, t.a.y, t.a.z);
            updR(t.b.x, t.b.y, t.b.z);
            updR(t.c.x, t.c.y, t.c.z);
        }

        const aspect = this.opts.width / this.opts.height;
        const fovRad = (this.opts.fov * Math.PI) / 180;
        const fovH = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);

        let distance = 1.2 * Math.max(r / Math.tan(fovRad / 2), r / Math.tan(fovH / 2));
        distance = Math.max(1e-3, distance * (isFinite(this.opts.distScale) ? this.opts.distScale : 1.0));

        const near = Math.max(1e-3, distance - r * 2);
        const far = distance + r * 2;

        const azRad = (this.opts.az * Math.PI) / 180;
        const elRad = (this.opts.el * Math.PI) / 180;

        let dirX = 0;
        let dirY = 0;
        let dirZ = 0;
        if(this.opts.up === 'z'){
            dirX = Math.cos(elRad) * Math.cos(azRad);
            dirY = Math.cos(elRad) * Math.sin(azRad);
            dirZ = Math.sin(elRad);
        }else{
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
        const upVec = (this.opts.up === 'z') ? vec3.fromValues(0,0,1) : vec3.fromValues(0,1,0);

        const view = mat4.create(); 
        mat4.lookAt(view, eye, center, upVec);

        const proj = mat4.create(); 
        mat4.perspective(proj, fovRad, aspect, near, far);

        const vp = mat4.create();
        mat4.multiply(vp, proj, view);

        const lightKeyView = (() => {
            const v = vec4.fromValues(LIGHTS.key.dir[0], LIGHTS.key.dir[1], LIGHTS.key.dir[2], 0);
            vec4.transformMat4(v, v, view);
            const d = vnorm([v[0], v[1], v[2]]);
            return d;
        })();

        const out2D: P2D[] = [];
        const v4 = vec4.create();
        for(const point of usePoints){
            vec4.set(v4, point.x, point.y, point.z, 1.0);
            vec4.transformMat4(v4, v4, vp);
            const w = v4[3]; 
            if(w === 0) continue;

            const ndcX = v4[0] / w;
            const ndcY = v4[1] / w;
            const ndcZ = v4[2] / w;

            if(ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1 || ndcZ < -1 || ndcZ > 1) continue;
            const sx = (ndcX * 0.5 + 0.5) * this.opts.width;
            const sy = (1 - (ndcY * 0.5 + 0.5)) * this.opts.height;
            out2D.push({ sx, sy, z: ndcZ, c: point.c }); 
        }
        out2D.sort((a, b) => b.z - a.z);

        type Tri2DPlus = Tri2D & { tri3D: Triangle3D };
        const outTris2D: Tri2DPlus[] = [];
        const projV = (x: number, y: number, z: number) => {
            vec4.set(v4, x, y, z, 1.0);
            vec4.transformMat4(v4, v4, vp);
            const w = v4[3];
            if(w === 0) return null;

            const ndcX = v4[0] / w;
            const ndcY = v4[1] / w;
            const ndcZ = v4[2] / w;
            if(ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY> 1 || ndcZ < -1 || ndcZ > 1) return null;
            return { sx:(ndcX * 0.5 + 0.5) * this.opts.width, sy: (1 - (ndcY * 0.5 + 0.5)) * this.opts.height, z:ndcZ };
        };

        for(const triangle of tris){
            const A = projV(triangle.a.x, triangle.a.y, triangle.a.z);
            const B = projV(triangle.b.x, triangle.b.y, triangle.b.z);
            const C = projV(triangle.c.x, triangle.c.y, triangle.c.z);
            if(!A || !B || !C) continue;

            // Backface culling 2D
            const cross = (B.sx - A.sx) * (C.sy - A.sy) - (B.sy - A.sy) * (C.sx - A.sx);
            if(cross >= 0) continue;
            
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
                tri3D: triangle
            });
        }

        outTris2D.sort((a, b) => b.z - a.z);
        if(out2D.length === 0 && outTris2D.length === 0){
            throw new Error('Increase fov or distScale');
        }

        const canvas = createCanvas(this.opts.width, this.opts.height);
        const ctx = canvas.getContext('2d');
        if(this.opts.background !== 'transparent'){
            ctx.fillStyle = this.opts.background;
            ctx.fillRect(0, 0, this.opts.width, this.opts.height);
        }

        const shadeTriangle = (t: Triangle3D, base: [number, number, number]) => {
            // normal face in WORLD
            const va: [number, number, number] = [t.a.x, t.a.y, t.a.z];
            const vb: [number, number, number] = [t.b.x, t.b.y, t.b.z];
            const vc: [number, number, number] = [t.c.x, t.c.y, t.c.z];
            const n = vnorm(vcross(vsub(vb, va), vsub(vc, va)));

            // vector view (from center of triangle)
            const center: [number, number, number] = [
                (va[0] + vb[0] + vc[0]) / 3,
                (va[1] + vb[1] + vc[1]) / 3,
                (va[2] + vb[2] + vc[2]) / 3
            ];
            const vdir = vnorm(vsub(center, [eye[0], eye[1],eye[2]]));

            // diffuse lighting
            // -dir
            const ndl_key  = clamp(vdot(n, mul3(LIGHTS.key.dir as any, -1) as any));
            const ndl_fill = clamp(vdot(n, mul3(LIGHTS.fill.dir as any, -1) as any));
            // ambient
            let col = mul3(base, LIGHTS.ambient); 

            col = add3(col, mul3(base, LIGHTS.key.intensity  * ndl_key));
            col = add3(col, mul3(base, LIGHTS.fill.intensity * ndl_fill));

            // rim light (highlights silhouette in light tights)
            const rim = Math.pow(clamp(1 - Math.abs(vdot(n, vdir))), LIGHTS.rim.power) * LIGHTS.rim.intensity;
            col = add3(col, mul3([1, 1, 1], rim)); 

            // tone mapping + clamp
            col = toneMapACES(col);
            col = [clamp(col[0]), clamp(col[1]), clamp(col[2])] as [number, number, number];
            return col;
        };

        const screenShadowOffset = (() => {
            let sx = lightKeyView[0];
            let sy = -lightKeyView[1];

            const L = Math.hypot(sx, sy) || 1;
            sx /= L; 
            sy /= L;
            return [sx * LIGHTS.shadow.sizePx, sy * LIGHTS.shadow.sizePx] as [number, number];
        })();

        for(const t2 of outTris2D){
            const shaded = shadeTriangle(t2.tri3D, t2.cAvg);
            const [ox, oy] = screenShadowOffset;
            
            ctx.fillStyle = colorToCSS([0, 0, 0], LIGHTS.shadow.alpha);
            ctx.beginPath();
            ctx.moveTo(t2.a.x + ox, t2.a.y + oy);
            ctx.lineTo(t2.b.x + ox, t2.b.y + oy);
            ctx.lineTo(t2.c.x + ox, t2.c.y + oy);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = colorToCSS(shaded, 1);
            ctx.beginPath();
            ctx.moveTo(t2.a.x, t2.a.y);
            ctx.lineTo(t2.b.x, t2.b.y);
            ctx.lineTo(t2.c.x, t2.c.y);
            ctx.closePath();
            ctx.fill();            
        }

        const radius = Math.max(0.5, this.opts.pointSize);
        for(const p of out2D){
            ctx.fillStyle = colorToCSS([0,0,0], 0.12);
            ctx.beginPath();
            ctx.arc(p.sx + 1, p.sy + 1, radius, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = colorToCSS(p.c, 1);
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, radius, 0, Math.PI*2);
            ctx.fill();
        }

        await new Promise<void>(async (resolve, reject) => {
            await mkdir(path.dirname(this.opts.outputPath), { recursive: true });
            const out = createWriteStream(this.opts.outputPath);
            canvas.createPNGStream().pipe(out);
            out.on('finish', resolve);
            out.on('error', reject);
        });
    }
}

export default HeadlessRasterizer;