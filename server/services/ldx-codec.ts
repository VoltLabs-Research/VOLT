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

// Lamps Delta eXchange (LDX1)
import * as fs from 'fs';
import { FileHandle, open, readdir, readFile, stat } from 'fs/promises';
import * as path from 'path';
import { createInterface } from 'readline/promises';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

type FloatBytes = 4 | 8;
type BoxFmt = { notation: 'exp' | 'fixed'; precision: number };

type RawHeaders = {
    atoms: string; 
    box: string;
    boxFmt?: BoxFmt;
};

type Frame = {
    timestep: number;
    ids: Uint32Array;
    positions: Float64Array; 
    box?: [number, number, number, number, number, number];
    raw?: RawHeaders;
};

interface EncodeOptions{
    floatBytes?: FloatBytes;
    keyframeInterval?: number;
    epsilon?: number;
    assumeFixedAtomSet?: boolean; 
    hasBox?: boolean;
}

interface Header{
    numAtoms: number;
    keyframeInterval: number;
    floatBytes: FloatBytes; 
    boxBytes: 8 | 4; 
    fields: { id: string; x: string; y: string; z: string };
    hasBox: boolean;
    rawHeaders?: RawHeaders;     
}

interface IndexEntry{
    frame: number; 
    timestep: number; 
    offset: number; 
    type: 0 | 1; 
    nChanged: number 
}

const setBit = (bits: Uint8Array, i: number) => {
    const byte = i >> 3;
    const bit = i & 7;
    bits[byte] |= (1 << bit);
};

const getBit = (bits: Uint8Array, i: number) => {
    const byte = i >> 3; 
    const bit = i & 7; 
    return (bits[byte] >>> bit) & 1;
};

const floatWriter = (floatBytes: FloatBytes) => {
    return (view: DataView, off: number, v: number) => {
        if(floatBytes === 4){
            view.setFloat32(off, v, true);
        }else{
            view.setFloat64(off, v, true);
        }
    };
}

const floatReader = (floatBytes: FloatBytes) => {
    return (view: DataView, off: number) => {
        if(floatBytes === 4){
            return view.getFloat32(off, true);
        }

        return view.getFloat64(off, true);
    }
}

const readExact = async (fileHandle: FileHandle, offset: number, length: number): Promise<Buffer> => {
    const buffer = Buffer.allocUnsafe(Math.max(0, length));
    let read = 0;

    while(read < length){
        const { bytesRead } = await fileHandle.read(buffer, read, length - read, offset + read);
        if(bytesRead === 0){
            throw new Error('EOF');
        }

        read += bytesRead;
    }

    return buffer;
};

const detectBoxFmt = (line: string): BoxFmt => {
    const hasExp = /[eE][+-]?\d+/.test(line);
    const match = line.trim().split(/\s+/).map((token) => {
        const lToken = token.toLowerCase();
        const idx = lToken.indexOf('e');
        const frac = idx >= 0 ? lToken.slice(0, idx) : lToken;
        const dot = frac.indexOf('.');
        return dot >= 0 ? (frac.length - dot - 1) : 0;
    });

    const precision = Math.max(0, ...match);
    return {
        notation: hasExp ? 'exp' : 'fixed',
        precision: precision || 6
    };
};

const fmtNumberWith = (boxFmt: BoxFmt | undefined, value: number): string => {
    const fmt = boxFmt ?? { notation: 'fixed', precision: 6 };
    return fmt.notation === 'exp' ? value.toExponential(fmt.precision) : value.toFixed(fmt.precision);
};

interface DumpParseOptions { 
    idField?: string; 
    xField?: string; 
    yField?: string; 
    zField?: string; 
}

async function *parseLammpsDump(
    filePath: string, 
    opts: DumpParseOptions = {}
) : AsyncGenerator<Frame>{
    const idField = opts.idField ?? 'id';
    const xField = opts.xField ?? 'x';
    const yField = opts.yField ?? 'y';
    const zField = opts.zField ?? 'z';

    const rl = createInterface({
        input: fs.createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    
    const it = rl[Symbol.asyncIterator]();
    const next = async () => {
        const r = await it.next();
        return r.done ? undefined : (r.value as string);
    };

    while(true){
        let line = await next();
        if(line === undefined) break;
        if(!line.startsWith('ITEM: TIMESTEP')) continue;

        const timestepLine = await next(); 
        if(timestepLine === undefined) break;

        const timestep = parseInt(timestepLine.trim(), 10);

        // ITEM: NUMBER OF ATOMS
        await next();
        const nLine = await next();
        if(nLine === undefined) break;
        const numAtoms = parseInt(nLine.trim(), 10);

        // BOX BOUNDS
        const boxHeader = await next();
        if(!boxHeader?.startsWith('ITEM: BOX BOUNDS')) throw new Error('Se espera encabezado BOX BOUNDS');

        const xbLine = (await next()) ?? ''; 
        const ybLine = (await next()) ?? ''; 
        const zbLine = (await next()) ?? '';

        const xb = xbLine.trim().split(/\s+/).map(Number);
        const yb = ybLine.trim().split(/\s+/).map(Number);
        const zb = zbLine.trim().split(/\s+/).map(Number);

        const box: [number, number, number, number, number, number] = [
            xb[0], xb[xb.length-1],
            yb[0], yb[yb.length-1],
            zb[0], zb[zb.length-1],
        ];

        const boxFmt = detectBoxFmt(xbLine + ' ' + ybLine + ' ' + zbLine);
        const atomsHeader = await next();
        if(!atomsHeader || !atomsHeader.startsWith('ITEM: ATOMS ')){
            throw new Error('Se espera encabezado ITEM: ATOMS');
        }

        const fields = atomsHeader.substring('ITEM: ATOMS '.length).trim().split(/\s+/);
        const field = { 
            id: fields.indexOf(idField), 
            x: fields.indexOf(xField), 
            y: fields.indexOf(yField), z: fields.indexOf(zField) 
        };

        if(field.id < 0 || field.x < 0 || field.y < 0 || field.z < 0) {
            throw new Error(`Required fields not found in ATOMS section: ${idField}, ${xField}, ${yField}, ${zField}`);
        }

        const ids = new Uint32Array(numAtoms);
        const pos = new Float64Array(numAtoms * 3);

        for (let i=0; i<numAtoms; i++) {
            const row = await next();
            if(row === undefined){
                throw new Error('EOF');
            }

            const parts = row.trim().split(/\s+/);
            const id = Number(parts[field.id]);
            const x = Number(parts[field.x]);
            const y = Number(parts[field.y]);
            const z = Number(parts[field.z]);
            
            ids[i] = id >>> 0;
            const j = i * 3; 

            pos[j] = x; 
            pos[j + 1] = y; 
            pos[j + 2] = z;
        }

        yield {
            timestep,
            ids,
            positions: pos,
            box,
            raw: { atoms: atomsHeader, box: boxHeader, boxFmt },
        };
    }

    rl.close();
};

const _natcmp = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;

const ceilDiv = (a: number, b: number) => {
    return Math.floor((a + b - 1) / b);
};

export async function *parseTrajectoryInput(
    inputPath: string, 
    opts: DumpParseOptions = {}
) : AsyncGenerator<Frame>{
    const fileStat = await stat(inputPath).catch(() => null);
    if(fileStat && fileStat.isDirectory()){
        const entries = await readdir(inputPath, { withFileTypes: true });
        const files = entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .filter((name) => !name.startsWith('.'))
            .sort(_natcmp);
        
        for(const name of files){
            const filePath = path.join(inputPath, name);
            for await(const frame of parseLammpsDump(filePath, opts)){
                yield frame;
            }
        }

        return;
    }

    for await (const frame of parseLammpsDump(inputPath, opts)){
        yield frame;
    }
}

export class LdxEncoder{
    private output: fs.WriteStream;
    private opts: Required<EncodeOptions>;
    private header?: Header;
    private idToIndex = new Map<number, number>();
    private indexToId!: Uint32Array;
    private lastPositions!: Float64Array;
    private frameCount = 0;
    private floatBytes: FloatBytes; 
    private writeFloat: (view: DataView, off: number, v: number) => void;
    private bytesWritten = 0;
    private indexEntries: IndexEntry[] = [];

    constructor(outputPath: string, opts: EncodeOptions = {}){
        this.output = fs.createWriteStream(outputPath);
        this.opts = {
            floatBytes: opts.floatBytes ?? 4,
            keyframeInterval: opts.keyframeInterval ?? 60,
            epsilon: opts.epsilon ?? 0,
            assumeFixedAtomSet: opts.assumeFixedAtomSet ?? true,
            hasBox: opts.hasBox ?? true,
        } as Required<EncodeOptions>;

        this.floatBytes = this.opts.floatBytes;
        this.writeFloat = floatWriter(this.floatBytes);
    }

    private writeChunk(buffer: ArrayBuffer){
        const buf = Buffer.from(buffer);
        this.output.write(buf);
        this.bytesWritten += buf.byteLength;
    }

    private writeBuffer(buffer: Buffer){
        this.output.write(buffer);
        this.bytesWritten += buffer.length;
    }

    private initFirstFrame(frame: Frame){
        const totalIds = frame.ids.length;
        this.indexToId = new Uint32Array(totalIds);

        for(let i = 0; i < totalIds; i++){
            const id = frame.ids[i];
            this.idToIndex.set(id, i);
            this.indexToId[i] = id;
        }

        this.lastPositions = frame.positions.slice();
        
        const header: Header = {
            numAtoms: totalIds,
            keyframeInterval: this.opts.keyframeInterval,
            floatBytes: this.opts.floatBytes,
            boxBytes: 8,
            fields: { id: 'id', x: 'x', y: 'y', z: 'z' },
            hasBox: this.opts.hasBox,
            rawHeaders: {
                atoms: frame.raw?.atoms ?? 'ITEM: ATOMS id x y z',
                box: frame.raw?.box ?? 'ITEM: BOX BOUNDS pp pp pp',
                boxFmt: frame.raw?.boxFmt,
            },
        };

        this.header = header;

        const magic = Buffer.from('LDX1');
        this.writeBuffer(magic);

        const json = Buffer.from(JSON.stringify(header), 'utf8');
        const h = new ArrayBuffer(4);
        const hv = new DataView(h);
        hv.setUint32(0, json.length, true);
        this.writeChunk(h);
        this.writeBuffer(json);

        const idxBuf = new ArrayBuffer(totalIds * 4);
        const iv = new DataView(idxBuf);

        for(let i = 0; i < totalIds; i++){
            iv.setUint32(i * 4, this.indexToId[i], true);
        }

        this.writeChunk(idxBuf);
    }

    private packPositions(indexes: number[], pos: Float64Array): ArrayBuffer{
        const n = indexes.length;
        const bytes = n * 3 * this.floatBytes;
        const buf = new ArrayBuffer(bytes);
        const view = new DataView(buf);

        let off = 0;
        for(const idx of indexes){
            const j = idx * 3;
            this.writeFloat(view, off, pos[j]); 
            off += this.floatBytes;

            this.writeFloat(view, off, pos[j+1]); 
            off += this.floatBytes;

            this.writeFloat(view, off, pos[j+2]); 
            off += this.floatBytes;
        }

        return buf;
    }

    private emitFrameRecord(
        type: 0 | 1, 
        timestep: number, 
        changedIdx: number[],
        pos: Float64Array,
        box?: Frame['box']
    ){
        const nAtoms = this.header!.numAtoms;
        const nChanged = type === 0 ? nAtoms : changedIdx.length;

        const frameOffset = this.bytesWritten;
        const currentFrame = this.frameCount;

        const head = new ArrayBuffer(1 + 4 + 4);
        const hv = new DataView(head);

        hv.setUint8(0, type);
        hv.setUint32(1, timestep, true);
        hv.setUint32(5, nChanged, true);

        this.writeChunk(head);

        const nb = ceilDiv(nAtoms, 8);
        const bits = new Uint8Array(nb);
        if(type === 0){
            bits.fill(0xFF);
        }else{
            for(const idx of changedIdx){
                setBit(bits, idx);
            }
        }

        this.writeBuffer(Buffer.from(bits));

        const payloadBuf = this.packPositions(type === 0 ? [...Array(nAtoms).keys()] : changedIdx, pos);
        this.writeChunk(payloadBuf);

        if(this.opts.hasBox){
            const bbuf = new ArrayBuffer(6 * 8);
            const bv = new DataView(bbuf);
            const B = box ?? [0, 0, 0, 0, 0, 0];
            let offset = 0;

            for(const value of B){
                bv.setFloat64(offset, value, true);
                offset += 8;
            }

            this.writeChunk(bbuf);
        }

        this.indexEntries.push({
            frame: currentFrame,
            timestep,
            offset: frameOffset,
            type,
            nChanged
        });
    }

    private diffIndices(current: Float64Array, epsilon: number): number[]{
        const n = current.length / 3;
        const changed: number[] = [];
        for(let i = 0; i < n; i++){
            const j = i * 3;
            if(Math.abs(current[j] - this.lastPositions[j]) > epsilon ||
                Math.abs(current[j + 1] - this.lastPositions[j + 1]) > epsilon ||
                Math.abs(current[j + 2] - this.lastPositions[j + 2]) > epsilon){
                changed.push(i);
            }
        }

        return changed;
    }

    async appendFrame(frame: Frame){
        if(!this.header) this.initFirstFrame(frame);
        const n = this.header!.numAtoms;

        if(this.opts.assumeFixedAtomSet){
            if(frame.ids.length !== n){
                throw new Error('Different number of atoms');
            }

            const ordered = new Float64Array(n * 3);
            for(let i = 0; i < n; i++){
                const id = frame.ids[i];
                const idx = this.idToIndex.get(id);
                if(idx === undefined){
                    throw new Error(`ID ${id} doesn't exist in the first frame`);
                }
                const src = i * 3;
                const dst = idx * 3;
                ordered[dst] = frame.positions[src];
                ordered[dst + 1] = frame.positions[src + 1];
                ordered[dst + 2] = frame.positions[src + 2];
            }

            const makeKeyFrame = (this.frameCount % this.opts.keyframeInterval) === 0;
            if(makeKeyFrame){
                this.emitFrameRecord(0, frame.timestep, [], ordered, frame.box);
                this.lastPositions = ordered;
            }else{
                const changed = this.diffIndices(ordered, this.opts.epsilon);
                this.emitFrameRecord(1, frame.timestep, changed, ordered, frame.box);
                for(const idx of changed){
                    const j = idx * 3;
                    this.lastPositions[j]   = ordered[j];
                    this.lastPositions[j + 1] = ordered[j + 1];
                    this.lastPositions[j + 2] = ordered[j + 2];
                }
            }

            this.frameCount++;
        }else{
            throw new Error('Variable set mode not implemented');
        }
    }

    getIndex(){
        return this.indexEntries.slice();
    }

    async close(){
        await new Promise<void>((resolve) => this.output.end(resolve));
    }
}

export class LdxDecoder{
    private fileHandle!: FileHandle;
    private filePath: string;
    private fileSize = 0;
    private header!: Header;
    private indexToId!: Uint32Array;
    private floatBytes!: FloatBytes;
    private readFloat!: (view: DataView, off: number) => number;
    private framesOffset = 0;
    private nAtoms = 0;
    private nb = 0;
    private index: IndexEntry[] | null = null;
    private boxBytes: 8 | 4 = 8;  

    constructor(filePath: string){
        this.filePath = filePath;
    }

    async open(){
        this.fileHandle = await open(this.filePath, 'r');
        const fileStat = await this.fileHandle.stat();
        this.fileSize = Number(fileStat.size);
    }

    async close(){
        if(this.fileHandle){
            await this.fileHandle.close();
        }
    }

    async loadMeta(){
        if(this.fileHandle) await this.open();
        let offset = 0;

        const head = await readExact(this.fileHandle, offset, 8);
        offset += 8;
        
        const magic = head.subarray(0, 4).toString('utf8');
        if(magic !== 'LDX1'){
            throw new Error('Invalid Magic');
        }

        const dvh = new DataView(head.buffer, head.byteOffset, head.byteLength);
        const jsonLen = dvh.getUint32(4, true);


        const jsonBuf = await readExact(this.fileHandle, offset, jsonLen); 
        offset += jsonLen;
        
        this.header = JSON.parse(jsonBuf.toString('utf8')) as Header;
        this.nAtoms = this.header.numAtoms;
        this.floatBytes = this.header.floatBytes;
        this.readFloat = floatReader(this.floatBytes);
        this.nb = ceilDiv(this.nAtoms, 8);
        this.boxBytes = (this.header.boxBytes ?? 8) as 8 | 4;

        const idxBytes = this.nAtoms * 4;
        const idxBuf = await readExact(this.fileHandle, offset, idxBytes);
        offset += idxBytes;

        this.indexToId = new Uint32Array(this.nAtoms);
        const dv = new DataView(idxBuf.buffer, idxBuf.byteOffset, idxBuf.byteLength);
        for(let i = 0; i < this.nAtoms; i++){
            this.indexToId[i] = dv.getUint32(i * 4, true);
        }
    
        this.framesOffset = offset;
    }

    async tryLoadExternalIndex(): Promise<boolean>{
        try{
            const idxPath = this.filePath + '.idx.json';
            const txt = await readFile(idxPath, 'utf8');
            const parsed = JSON.parse(txt) as { index: IndexEntry[] };
            if(Array.isArray(parsed.index) && parsed.index.length > 0){
                this.index = parsed.index;
                return true;
            }
        }catch{}

        return false;
    }

    async buildIndex(): Promise<IndexEntry[]>{
        if(!this.fileHandle) await this.open();
        if(!this.header) await this.loadMeta();

        const found = await this.tryLoadExternalIndex();
        if(found && this.index) return this.index;

        const idx: IndexEntry[] = [];
        let offset = this.framesOffset;
        let frame = 0;

        while(offset < this.fileSize){
            const h = await readExact(this.fileHandle, offset, 9);
            const dvh = new DataView(h.buffer, h.byteOffset, h.byteLength);
            const type = dvh.getUint8(0) as 0 | 1;
            const timestep = dvh.getUint32(1, true);
            const nChanged = dvh.getUint32(5, true);
            const bitsetOffset = offset + 9;
            const payloadOffset = bitsetOffset + this.nb;
            const posBytes = (type === 0 ? this.nAtoms : nChanged) * 3 * this.floatBytes;
            const boxBytes = this.header.hasBox ? 6 * this.boxBytes : 0;
            const next = payloadOffset + posBytes + boxBytes;
            if(next > this.fileSize){
                throw new Error('EOF');
            }

            idx.push({ frame, timestep, offset, type, nChanged });
            offset = next;
            frame++;
        }

        this.index = idx;
        return idx;
    }

    getHeader(): Header{
        return this.header;
    }

    getIndexToId(): Uint32Array{
        return this.indexToId;
    }

    async extractFrame(frameIndex: number): Promise<any> {
        if(!this.header) await this.loadMeta();
        const idx = await this.buildIndex();
        if(frameIndex < 0 || frameIndex >= idx.length){
            throw new Error('out of range');
        }

        let start = frameIndex;
        while(start > 0 && idx[start].type !== 0){
            start--;
        }

        const n = this.nAtoms;
        const work = new Float64Array(n * 3);
        let lastBox;
        let timestep = 0;

        for(let f = start; f <= frameIndex; f++){
            const { timestep: ts } = await this.applyFrameAtOffset(idx[f].offset, work);
            timestep = ts;
            if(this.header.hasBox){
                lastBox = this._tmpBox ?? lastBox;
            }
        }
    }

    private _tmpBox: any;

    private async applyFrameAtOffset(offset: number, work: Float64Array): Promise<{ timestep: number }> {
        const h = await readExact(this.fileHandle, offset, 9);
        const dvh = new DataView(h.buffer, h.byteOffset, h.byteLength);
        const type = dvh.getUint8(0) as 0 | 1;
        const timestep = dvh.getUint32(1, true);
        const nChanged = dvh.getUint32(5, true);
        const bitselfBuf = await readExact(this.fileHandle, offset + 9, this.nb);
        const bits = new Uint8Array(bitselfBuf.buffer, bitselfBuf.byteOffset, bitselfBuf.byteLength);
        const count = (type === 0) ? this.nAtoms : nChanged;
        const posBytes = count * 3 * this.floatBytes;
        const posBuf = await readExact(this.fileHandle, offset + 9 + this.nb, posBytes);
        const pv = new DataView(posBuf.buffer, posBuf.byteOffset, posBuf.byteLength);

        this._tmpBox = undefined;
        if(this.header.hasBox){
             const boxOffset = offset + 9 + this.nb + posBytes;
            const boxBuf = await readExact(this.fileHandle, boxOffset, 6 * this.boxBytes);
            const bv = new DataView(boxBuf.buffer, boxBuf.byteOffset, boxBuf.byteLength);
            const readBox = (view: DataView, off: number) => this.boxBytes === 8 ? view.getFloat64(off, true) : view.getFloat32(off, true);
            this._tmpBox = [
                readBox(bv, 0), readBox(bv, this.boxBytes * 1),
                readBox(bv, this.boxBytes * 2), readBox(bv, this.boxBytes * 3),
                readBox(bv, this.boxBytes * 4), readBox(bv, this.boxBytes * 5),
            ];
        }

        let pOff = 0;
        if(type === 0){
            for(let i = 0; i < this.nAtoms; i++){
                const j = i * 3;
                work[j] = this.readFloat(pv, pOff);
                pOff += this.floatBytes;
                
                work[j + 1] = this.readFloat(pv, pOff);
                pOff += this.floatBytes;
                
                work[j + 2] = this.readFloat(pv, pOff);
                pOff += this.floatBytes;
            }
        }else{
            for(let i = 0; i < this.nAtoms; i++){
                if(getBit(bits, i)){
                    const j = i*3;
                    work[j] = this.readFloat(pv, pOff); 
                    pOff += this.floatBytes;
                    work[j+1] = this.readFloat(pv, pOff); 
                    pOff += this.floatBytes;
                    work[j+2] = this.readFloat(pv, pOff); 
                    pOff += this.floatBytes;
                }
            }
        }

        return { timestep };
    }
}