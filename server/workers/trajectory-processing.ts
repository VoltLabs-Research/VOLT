/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 * TRAJECTORY PROCESSING WORKER - CLOUD NATIVE VERSION
 */

import { extractTimestepInfo } from '@/utilities/lammps';
import { unlink, writeFile } from 'fs/promises';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import AtomisticExporter from '@/utilities/export/atoms';
import DumpStorage from '@/services/dump-storage';
import '@config/env';
import logger from '@/logger';
import * as path from 'node:path';
import * as os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import { parentPort } from 'node:worker_threads';

const glbExporter = new AtomisticExporter();

const processSingleFrame = async (frameData: any, frameFilePath: string, trajectoryId: string) => {
    let localProcessingPath = frameFilePath;
    let isTempFile = false;

    try {
        // 1. Detectar si el archivo está en MinIO (Cloud-First Architecture)
        if (frameFilePath.startsWith('minio://')) {
            // El controlador ya subió el dump. Necesitamos descargarlo temporalmente
            // para que el exportador (que suele usar herramientas CLI) pueda leerlo.
            const tempFileName = `proc_${trajectoryId}_${frameData.timestep}_${uuidv4()}.dump`;
            localProcessingPath = path.join(os.tmpdir(), tempFileName);
            
            // Descargar stream desde DumpStorage y escribir en disco local
            const stream = await DumpStorage.getDumpStream(trajectoryId, frameData.timestep);
            await writeFile(localProcessingPath, stream);
            isTempFile = true;
        }

        // 2. Generar GLB y subirlo directamente a MinIO (Bucket MODELS)
        // Nota: glbExporter.toGLBMinIO se encarga de la subida del GLB resultante.
        const objectName = `trajectory-${trajectoryId}/previews/timestep-${frameData.timestep}.glb`;
        
        await glbExporter.toGLBMinIO(
            localProcessingPath,
            objectName,
            extractTimestepInfo
        );

        // 3. Limpieza
        if (isTempFile) {
            await unlink(localProcessingPath).catch(() => {});
        } else {
            // Compatibilidad Legacy: Si el archivo venía de una ruta local (no minio://),
            // asumimos que el worker es responsable de limpiarlo si ya no se necesita.
            // (Aunque con el nuevo controlador, esto raramente ocurrirá).
            await unlink(frameFilePath).catch(() => {});
        }

        // NOTA: Ya NO llamamos a DumpStorage.saveDump aquí.
        // El controlador ya se encargó de la persistencia del Dump crudo.

    } catch (err) {
        logger.error(`[Worker #${process.pid}] Failed to process frame ${frameData.timestep}: ${err}`);
        
        // Asegurar limpieza en caso de error
        if (isTempFile && localProcessingPath) {
            await unlink(localProcessingPath).catch(() => {});
        }
        
        throw err; // Re-lanzar para que processJob lo capture
    }
};

const processJob = async (job: TrajectoryProcessingJob) => {
    if (!job || !job.jobId) {
        throw new Error('Invalid job payload');
    }

    const { files, trajectoryId } = job;

    logger.info(
        `[Worker #${process.pid}] Start job ${job.jobId} ` +
        `(chunk ${job.chunkIndex + 1}/${job.totalChunks})`
    );

    try {
        // Procesar frames en paralelo (limitado por el tamaño del chunk del controlador, usualmente 20)
        await Promise.all(files.map(({ frameData, frameFilePath }) => 
            processSingleFrame(frameData, frameFilePath, trajectoryId)
        ));

        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId,
            chunkIndex: job.chunkIndex,
            totalChunks: job.totalChunks
        });

        logger.info(`[Worker #${process.pid}] Job ${job.jobId} completed OK.`);
    } catch (error) {
        logger.error(
            `[Worker #${process.pid}] Job ${job.jobId} failed: ${error}`
        );

        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            chunkIndex: job.chunkIndex,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

const main = () => {
    logger.info(`[Worker #${process.pid}] Worker started`);

    parentPort?.on('message', async ({ job }) => {
        try {
            await processJob(job);
        } catch (error) {
            logger.error(`[Worker #${process.pid}] Fatal worker error: ${error}`);

            parentPort?.postMessage({
                status: 'failed',
                jobId: job?.jobId || 'unknown',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
};

main();