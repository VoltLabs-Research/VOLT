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

import { createReadStream } from 'fs';
import { stat, copyFile as fsCopyFile, rm } from 'fs/promises';
import { createInterface } from 'readline';

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