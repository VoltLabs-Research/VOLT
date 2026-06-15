import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import { stageExportBufferUpload } from '@/modules/plugin/application/exports/export-node-processor-shared';
import type { ConfigurationExporterOptions, ConfigurationExportFormat, ExportExecutionInput } from '@/modules/plugin/application/exports/export-node-processor-types';
import { logger } from '@/core/logger';

const BRIDGE_SCRIPT = path.join(__dirname, '../../../trajectory/infrastructure/parsing/ase_export_bridge.py');
const ASE_PYTHON = process.env['ASE_PYTHON'] ??
    path.join(__dirname, '../../../../../../../.venv-pyatomsk/bin/python');

const FORMAT_EXTENSIONS: Record<ConfigurationExportFormat, string> = {
    'lammps-dump': 'dump',
    'lammps-data': 'lammps',
    'extxyz': 'xyz',
    'poscar': 'vasp',
    'cif': 'cif',
};

const CONTENT_TYPES: Record<ConfigurationExportFormat, string> = {
    'lammps-dump': 'text/plain',
    'lammps-data': 'text/plain',
    'extxyz': 'text/plain',
    'poscar': 'text/plain',
    'cif': 'text/plain',
};

const runBridge = (
    parquetPath: string,
    outputPath: string,
    options: ConfigurationExporterOptions
): Promise<void> => new Promise((resolve, reject) => {
    const args = [
        BRIDGE_SCRIPT,
        parquetPath,
        outputPath,
        options.format,
        JSON.stringify(options.columnMapping),
        JSON.stringify(options.aseWriteKwargs ?? {})
    ];

    const proc = spawn(ASE_PYTHON, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderrChunks: Buffer[] = [];
    proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    proc.on('error', reject);
    proc.on('close', (code) => {
        if (code === 0) {
            resolve();
        } else {
            const msg = Buffer.concat(stderrChunks).toString().trim();
            reject(new Error(`ase_export_bridge exited ${code}: ${msg}`));
        }
    });
});

export const exportConfigurationArtifact = async (
    input: ExportExecutionInput,
    options: ConfigurationExporterOptions,
    objectPath: string,
    ownerClusterId: string
): Promise<void> => {
    const ext = FORMAT_EXTENSIONS[options.format];
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'volt-cfg-export-'));
    const tmpOutput = path.join(tmpDir, `export.${ext}`);

    try {
        await runBridge(input.outputFilePath, tmpOutput, options);

        const buffer = await fs.readFile(tmpOutput);
        await stageExportBufferUpload(input, {
            exporter: 'ConfigurationExporter',
            bucket: ObjectBucketName.Models,
            buffer,
            contentType: CONTENT_TYPES[options.format],
            objectPath,
            ownerClusterId
        });
    } catch (err) {
        logger.error({ err, analysisId: input.executionData.analysisId, format: options.format },
            'ConfigurationExporter failed');
        throw err;
    } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
    }
};
