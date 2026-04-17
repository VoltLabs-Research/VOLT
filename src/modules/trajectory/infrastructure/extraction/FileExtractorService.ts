import { createWriteStream } from 'node:fs';
import { logger } from '@/core/logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import unzipper from 'unzipper';

interface UploadedFile {
    path?: string;
    size: number;
    originalname?: string;
    mimetype?: string;
    buffer?: Buffer;
};

interface ExtractedFile {
    path: string;
    originalname: string;
    size: number;
    mimetype?: string;
};

const isJunkEntry = (entryPath: string): boolean => {
    const basename = path.basename(entryPath);
    return (
        basename.startsWith('.') ||
        basename === '__MACOSX' ||
        entryPath.includes('__MACOSX/') ||
        basename === '.DS_Store' ||
        basename === 'Thumbs.db'
    );
};

export class FileExtractorService {
    async extractFiles(files: UploadedFile[], workingDir: string): Promise<ExtractedFile[]> {
        const finalFiles: ExtractedFile[] = [];

        for (const file of files) {
            const isZip = file.mimetype === 'application/zip' || file.originalname?.endsWith('.zip');

            if (isZip) {
                let zipPath = file.path;
                let tempZipCreated = false;
                if (!zipPath && file.buffer) {
                    zipPath = path.join(workingDir, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.zip`);
                    await fs.writeFile(zipPath, file.buffer);
                    tempZipCreated = true;
                }

                if (!zipPath) {
                    continue;
                }

                finalFiles.push(...await this.extractZipViaOpenFile(zipPath, workingDir));

                if (tempZipCreated) {
                    await fs.unlink(zipPath).catch(() => {});
                }

                continue;
            }

            if (!file.path && file.buffer) {
                const tempPath = path.join(workingDir, file.originalname || `upload_${Date.now()}`);
                await fs.writeFile(tempPath, file.buffer);
                file.path = tempPath;
            }

            if (!file.path || !file.originalname) {
                continue;
            }

            finalFiles.push({
                path: file.path,
                originalname: file.originalname,
                size: file.size,
                mimetype: file.mimetype
            });
        }

        return finalFiles;
    }

    private async extractZipViaOpenFile(zipPath: string, outputDir: string): Promise<ExtractedFile[]> {
        const directory = await unzipper.Open.file(zipPath);
        const resolvedBase = path.resolve(outputDir);
        const extractedFiles: ExtractedFile[] = [];

        logger.info(
            { entryCount: directory.files.length, zipPath },
            'Opened ZIP via central directory for SSH import'
        );

        for (const entry of directory.files) {
            if (entry.type === 'Directory' || isJunkEntry(entry.path)) {
                continue;
            }

            const outputPath = path.join(outputDir, entry.path);
            const resolvedOutput = path.resolve(outputPath);
            if (!resolvedOutput.startsWith(resolvedBase + path.sep) && resolvedOutput !== resolvedBase) {
                logger.warn(
                    { entry: entry.path },
                    'Skipping ZIP entry with path traversal during SSH import'
                );
                continue;
            }

            await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
            await pipeline(entry.stream(), createWriteStream(resolvedOutput));

            const stats = await fs.stat(resolvedOutput);
            if (stats.size === 0) {
                continue;
            }

            extractedFiles.push({
                path: resolvedOutput,
                originalname: path.basename(entry.path),
                size: stats.size
            });
        }

        return extractedFiles;
    }

    async getFilesRecursive(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const resolvedPath = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? this.getFilesRecursive(resolvedPath) : resolvedPath;
        }));

        return Array.prototype.concat(...files) as string[];
    }
};
