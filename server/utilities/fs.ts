/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
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

import { createReadStream } from 'fs';
import { access, stat, copyFile as fsCopyFile, rm, readdir, constants } from 'fs/promises';
import { createInterface } from 'readline';
import { join } from 'path';
import logger from '@/logger';

interface ReadLargeFileOptions {
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

interface ReadBinaryFileOptions {
    chunkSize?: number;
    onChunk?: (chunk: Buffer, bytesRead: number) => void;
    onProgress?: (bytesRead: number) => void;
}

interface ReadBinaryFileResult {
    buffer: Buffer;
    totalBytes: number;
    metadata: Record<string, any>
}

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
            if (onChunk) onChunk(chunk, bytesRead);
            if (onProgress && bytesRead % (10 * 1024 * 1024) < chunk.length) {
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

export const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await access(filePath, constants.F_OK);
        return true;
    } catch (err: any) {
        if (err?.code === 'ENOENT') {
            return false;
        }

        throw err;
    }
};

export const copyFile = async (source: string, destination: string): Promise<void> => {
    logger.info(`Starting file copy: ${source} -> ${destination}`);

    try {
        const sourceStats = await stat(source);
        logger.info(`Source file size: ${sourceStats.size} bytes(${(sourceStats.size / 1024 / 1024).toFixed(2)}MB)`);

        if (sourceStats.size === 0) {
            throw new Error(`Source file is empty: ${source}`);
        }

        // Node.js built-in copyFile which is more reliable than streams for large files
        await fsCopyFile(source, destination);

        const destinationStats = await stat(destination);
        logger.info(`Destination file size: ${destinationStats.size} bytes(${(destinationStats.size / 1024 / 1024).toFixed(2)}MB)`);

        if (destinationStats.size !== sourceStats.size) {
            throw new Error(`File copy incomplete: source ${sourceStats.size} bytes, destination ${destinationStats.size} bytes`);
        }
    } catch (err) {
        logger.error(`Error copying file from ${source} to ${destination}: ${err}`);
        // Clean up partial file if it exists
        try {
            await rm(destination);
        } catch (cleanupError) { }

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
        let stopped = false;

        const fileStream = createReadStream(filePath, { encoding });
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        const cleanup = () => {
            if (!stopped) {
                stopped = true;
                rl.close();
                fileStream.destroy();
            }
        };

        rl.on('line', (line) => {
            if (stopped) return;

            lineCount++;

            // Only keep the necessary lines in memory
            if (lines.length < maxLines) {
                lines.push(line);
            }

            // Custom callback to process each line
            if (onLine) {
                onLine(line, lineCount);
            }

            // If we have onLine and hit maxLines, stop reading
            if (onLine && lineCount >= maxLines) {
                cleanup();
                resolve({
                    lines,
                    totalLines: lineCount,
                    metadata
                });
                return;
            }

            // Progress callback
            if (onProgress && lineCount % 1000 === 0) {
                onProgress(lineCount);
            }
        });

        rl.on('close', () => {
            if (!stopped) {
                resolve({
                    lines,
                    totalLines: lineCount,
                    metadata
                });
            }
        });

        rl.on('error', (err) => {
            cleanup();
            reject(err);
        });
    });
};
