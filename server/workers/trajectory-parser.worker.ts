/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Worker thread for parsing trajectory files.
 * This offloads the synchronous C++ parsing from the main Event Loop.
 */

import { parentPort, workerData } from 'worker_threads';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import TrajectoryParserFactory from '@/parsers/factory';
import DumpStorage from '@/services/trajectory/dump-storage';

interface ParseTaskMessage {
    type: 'parse';
    taskId: number;
    trajectoryId: string;
    tempPath: string;
    originalName: string;
    fileSize: number;
}

interface ParseResultMessage {
    type: 'result';
    taskId: number;
    success: boolean;
    data?: {
        frameInfo: any;
        srcPath: string;
        originalSize: number;
        originalName: string;
    };
    error?: string;
}

if (!parentPort) {
    throw new Error('This module must be run as a worker thread');
}

parentPort.on('message', async (message: ParseTaskMessage) => {
    if (message.type !== 'parse') return;

    const { taskId, trajectoryId, tempPath, originalName, fileSize } = message;

    try {
        // Parse and validate
        const frameInfo = await TrajectoryParserFactory.parseMetadata(tempPath);

        // Move file to cache location
        const cachePath = DumpStorage.getCachePath(trajectoryId, frameInfo.timestep);
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.rename(tempPath, cachePath);

        const result: ParseResultMessage = {
            type: 'result',
            taskId,
            success: true,
            data: {
                frameInfo,
                srcPath: `minio://${trajectoryId}/${frameInfo.timestep}`,
                originalSize: fileSize,
                originalName
            }
        };

        parentPort!.postMessage(result);
    } catch (err: any) {
        // Clean up temp file on error
        await fs.rm(tempPath).catch(() => { });

        const result: ParseResultMessage = {
            type: 'result',
            taskId,
            success: false,
            error: err?.message || 'Unknown parsing error'
        };

        parentPort!.postMessage(result);
    }
});
