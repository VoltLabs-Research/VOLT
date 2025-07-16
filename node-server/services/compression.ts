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

import { readFile, writeFile, stat } from 'fs/promises';
import { compress } from '@mongodb-js/zstd';
import { Worker } from 'worker_threads';
import { join, basename } from 'path';
import { existsSync } from 'fs';

class CompressionService{
    private compressionLevel: number = 0;

    compress(filePath: string, outputDir: string): Promise<{success: boolean, error?: string}>{
        return new Promise((resolve) => {
            const workerPath = join(__dirname, '../workers/compression.js');
            const worker = new Worker(workerPath, {
                workerData: {
                    filePath,
                    outputDir,
                    compressionLevel: this.compressionLevel
                }
            });

            worker.on('message', (result) => {
                if(result.success){
                    console.log(result.message);
                }else{
                    console.error(result.error);
                }

                resolve(result);
            });

            worker.on('error', (error) => {
                console.error(`Worker error: ${error.message}`);
                resolve({ success: false, error: error.message });
            });

            worker.on('exit', (code ) => {
                if(code !== 0){
                    console.error(`Worker exited with code ${code}`);
                }
            });
        });
    }

    setCompressionLevel(level: number): void{
        if(level < 1 || level > 22){
            throw new Error('Compression level must be between 1 and 22');
        }

        this.compressionLevel = level;
    }
};

export default CompressionService;