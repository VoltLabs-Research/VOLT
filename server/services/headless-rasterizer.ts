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

const colorToCSS = (rgb: [number, number, number], alpha = 1) => {
    const [r, g, b] = rgb;
    const R = Math.round(clamp01(lin2srgb(r)) * 255);
    const G = Math.round(clamp01(lin2srgb(g)) * 255);
    const B = Math.round(clamp01(lin2srgb(b)) * 255);
    return `rgba(${R},${G},${B},${clamp01(alpha)})`;
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

const traverseCollectPoints = (node: GNode, parentWorld: mat4, out: Point[]) => {
    const local = nodeLocalMatrix(node);
    const world = mat4.create();
    mat4.multiply(world, parentWorld, local);

    const mesh = node.getMesh();
    if(mesh){
        for(const prim of mesh.listPrimitives()){
            collectPointsFromPrimitive(prim, world, out);
        }
    }

    for(const child of node.listChildren()){
        traverseCollectPoints(child, world, out);
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
}

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
        if(!scenes.length){
            throw new Error('GLB_WITHOUT_SCENES');
        }

        const points: Point[] = [];
        for(const scene of scenes){
            for(const node of scene.listChildren()){
                traverseCollectPoints(node, mat4.create(), points);
            }
        }

        if(!points.length){
            throw new Error('NO_POSITION_ATTRIBUTES');
        }

        const { maxPoints } = this.opts;
        const usePoints = (maxPoints > 0 && points.length > maxPoints) ? reservoirSample(points, maxPoints) : points;
        
        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX =- Infinity;
        let maxY =- Infinity;
        let maxZ =- Infinity;

        for(const point of usePoints){
            if(point.x < minX) minX = point.x;
            if(point.y < minY) minY = point.y; 
            if(point.z < minZ) minZ = point.z;
            if(point.x > maxX) maxX = point.x; 
            if(point.y > maxY) maxY = point.y; 
            if(point.z > maxZ) maxZ = point.z;
        }

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const cz = (minZ + maxZ) / 2;

        let r = 0;
        for(const p of usePoints){
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dz = p.z - cz;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if(d > r) r = d;
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
            // Z-up
            dirX = Math.cos(elRad) * Math.cos(azRad);
            dirY = Math.cos(elRad) * Math.sin(azRad);
            dirZ = Math.sin(elRad);
        }else{
            // Y-up
            dirX = Math.cos(elRad) * Math.cos(azRad);
            dirY = Math.sin(elRad);
            dirZ = Math.cos(elRad) * Math.sin(azRad);
        }

        const len = Math.hypot(dirX, dirY, dirZ) || 1;
        dirX /= len; 
        dirY /= len; 
        dirZ /= len;

        const eye = vec3.fromValues(cx + dirX * distance, cy + dirY * distance, cz + dirZ * distance);
        const center = vec3.fromValues(cx, cy, cz);
        const upVec = (this.opts.up === 'z') ? vec3.fromValues(0, 0, 1) : vec3.fromValues(0, 1, 0);

        const view = mat4.create();
        mat4.lookAt(view, eye, center, upVec);

        const proj = mat4.create();
        mat4.perspective(proj, fovRad, aspect, near, far);

        const vp = mat4.create();
        mat4.multiply(vp, proj, view);
        
        const out2D: P2D[] = [];
        const v4 = vec4.create();
        for(const p of usePoints){
            vec4.set(v4, p.x, p.y, p.z, 1.0);
            vec4.transformMat4(v4, v4, vp);
            
            const w = v4[3]; 
            if(w === 0) continue;
            
            const ndcX = v4[0] / w;
            const ndcY = v4[1] / w;
            const ndcZ = v4[2] / w;

            if(ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1 || ndcZ < -1 || ndcZ > 1){
                continue;
            }

            const sx = (ndcX * 0.5 + 0.5) * this.opts.width;
            const sy = (1 - (ndcY * 0.5 + 0.5)) * this.opts.height;
            out2D.push({ sx, sy, z: ndcZ, c: p.c });
        }

        if(out2D.length === 0){
            throw new Error('Increase fov or distScale');
        }

        out2D.sort((a, b) => b.z - a.z);

        // Canvas & PNG
        const canvas = createCanvas(this.opts.width, this.opts.height);
        const ctx = canvas.getContext('2d');
        if(this.opts.background !== 'transparent'){
            ctx.fillStyle = this.opts.background;
            ctx.fillRect(0, 0, this.opts.width, this.opts.width);
        }

        const radius = Math.max(0.5, this.opts.pointSize * 0.5);
        for(const p of out2D){
            ctx.fillStyle = colorToCSS(p.c, 1);
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        await new Promise<void>((resolve, reject) => {
            const out = createWriteStream(this.opts.outputPath);
            canvas.createPNGStream().pipe(out);
            out.on('finish', resolve);
            out.on('error', reject);
        });        
    }
}

export default HeadlessRasterizer;