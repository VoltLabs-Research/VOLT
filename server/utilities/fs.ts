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

import { createReadStream, createWriteStream } from 'fs';
import { stat, copyFile as fsCopyFile, rm, readdir } from 'fs/promises';
import { createInterface } from 'readline';
import { once } from 'events';
import { AtomsGroupedByType } from '@/types/utilities/export/atoms';
import { join } from 'path';

interface ReadLargeFileOptions{
    maxLines?: number;
    encoding?: BufferEncoding;
    onLine?: (line: string, lineNumber: number) => void;
    onProgress?: (lineCount: number) => void;
}

interface ReadLargeFileResult {
    lines: string[];
    totalLines: number;
    metadata: Record<string, any>;
}

interface ReadBinaryFileOptions{
    chunkSize?: number;
    onChunk?: (chunk: Buffer, bytesRead: number) => void;
    onProgress?: (bytesRead: number) => void;
}

interface ReadBinaryFileResult{
    buffer: Buffer;
    totalBytes: number;
    metadata: Record<string, any>
}

export const listGlbFiles = async (dir: string, out: string[] = []): Promise<string[]> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for(const e of entries){
        if(!e.isFile()) continue;
        if(!/\.(glb|gltf)$/i.test(e.name)) continue;
        out.push(join(dir, e.name));
    }
    return out;
};

export const readBinaryFile = async (
    filePath: string,
    options: ReadBinaryFileOptions = {}
): Promise<ReadBinaryFileResult> => {
    const {
        // 1 mb
        chunkSize = 1024 * 1024,
        onChunk,
        onProgress
    } = options;

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let bytesRead = 0;
        const metadata: Record<string, any> = {};

        const stream = createReadStream(filePath, { highWaterMark: chunkSize });
        // @ts-ignore
        stream.on('data', (chunk: Buffer) => {
            bytesRead += chunk.length;
            chunks.push(chunk);
            if(onChunk) onChunk(chunk, bytesRead);
            if(onProgress && bytesRead % (10 * 1024 * 1024) < chunk.length){
                onProgress(bytesRead);
            }
        });

        stream.on('end', () => {
            resolve({
                buffer: Buffer.concat(chunks),
                totalBytes: bytesRead,
                metadata
            })
        });
        
        stream.on('error', reject);
    });
};

export const copyFile = async (source: string, destination: string): Promise<void> => {
    console.log(`Starting file copy: ${source} -> ${destination}`);

    try{
        const sourceStats = await stat(source);
        console.log(`Source file size: ${sourceStats.size} bytes (${(sourceStats.size / 1024 / 1024).toFixed(2)}MB)`);

        if(sourceStats.size === 0){
            throw new Error(`Source file is empty: ${source}`);
        }

        // Node.js built-in copyFile which is more reliable than streams for large files
        await fsCopyFile(source, destination);
        
        const destinationStats = await stat(destination);
        console.log(`Destination file size: ${destinationStats.size} bytes (${(destinationStats.size / 1024 / 1024).toFixed(2)}MB)`);

        if(destinationStats.size !== sourceStats.size){
            throw new Error(`File copy incomplete: source ${sourceStats.size} bytes, destination ${destinationStats.size} bytes`);
        }
    }catch(err){
        console.error(`Error copying file from ${source} to ${destination}:`, err);
        // Clean up partial file if it exists
        try{
            await rm(destination);
        }catch(cleanupError){}

        throw err;
    }
};

export const readLargeFile = async (
    filePath: string,
    options: ReadLargeFileOptions = {}
): Promise<ReadLargeFileResult> => {
    const {
        maxLines = 1000,
        encoding = 'utf8',
        onLine,
        onProgress
    } = options;

    return new Promise((resolve, reject) => {
        const lines: string[] = [];
        let lineCount = 0;
        const metadata: Record<string, any> = {};

        const fileStream = createReadStream(filePath, { encoding });
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            lineCount++;

            // Only keep the necessary lines in memory
            if(lines.length < maxLines){
                lines.push(line);
            }

            // Custom callback to process each line
            if(onLine){
                onLine(line, lineCount);
            }

            // Progress callback
            if(onProgress && lineCount % 1000 === 0){
                onProgress(lineCount);
            }
        });

        rl.on('close', () => {
            resolve({
                lines,
                totalLines: lineCount,
                metadata
            });
        });

        rl.on('error', (err) => {
            reject(err);
        });
    });
};

export const writeChunk = async (stream: NodeJS.WritableStream, chunk: string) => {
    if(!stream.write(chunk)){
        await once(stream, 'drain');
    }
};

export const writeGroupedJsonStreaming = async (filePath: string, data: AtomsGroupedByType) => {
    const writeStream = createWriteStream(filePath, { encoding: 'utf8' });
    writeStream.once('error', (err) => {
        throw err;
    });

    await writeChunk(writeStream, '{');
    const keys = Object.keys(data);

    for(let ki = 0; ki < keys.length; ki++){
        const key = keys[ki];
        const arr = data[key] ?? [];
        if(ki > 0) await writeChunk(writeStream, ',');

        await writeChunk(writeStream, JSON.stringify(key));
        await writeChunk(writeStream, ':[');

        for(let i = 0; i < arr.length; i++){
            if(i > 0) await writeChunk(writeStream, ',');
            await writeChunk(writeStream, JSON.stringify(arr[i]));
        }

        await writeChunk(writeStream, ']');
    }

    await writeChunk(writeStream, '}');
    await new Promise<void>((resolve, reject) => {
        writeStream.end(() => resolve());
        writeStream.once('error', reject);
    });
};