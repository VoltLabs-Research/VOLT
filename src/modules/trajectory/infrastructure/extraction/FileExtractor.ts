import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpName } from 'tmp-promise';
import unzipper from 'unzipper';
import { safeRemovePath } from '@/support/fs/safe-remove-path';

type CentralDirectory = Awaited<ReturnType<typeof unzipper.Open.file>>;

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

const JUNK_ENTRY_BASENAMES = new Set(['__MACOSX', '.DS_Store', 'Thumbs.db']);

@Service('fileExtractor')
export class FileExtractor {
    async extractFiles(files: UploadedFile[], workingDir: string): Promise<ExtractedFile[]> {
        const finalFiles: ExtractedFile[] = [];

        for (const file of files) {
            const isZip = file.mimetype === 'application/zip' || file.originalname?.endsWith('.zip');

            if (isZip) {
                let zipPath = file.path;
                let tempZipCreated = false;
                if (!zipPath && file.buffer) {
                    await fs.mkdir(workingDir, { recursive: true });
                    zipPath = await tmpName({
                        tmpdir: workingDir,
                        prefix: 'upload-',
                        postfix: '.zip'
                    });
                    await fs.writeFile(zipPath, file.buffer);
                    tempZipCreated = true;
                }

                if (!zipPath) {
                    continue;
                }

                finalFiles.push(...await this.extractZipViaOpenFile(zipPath, workingDir));

                if (tempZipCreated) {
                    await safeRemovePath(zipPath);
                }

                continue;
            }

            if (!file.path && file.buffer) {
                await fs.mkdir(workingDir, { recursive: true });
                const tempPath = await tmpName({
                    tmpdir: workingDir,
                    prefix: 'upload-',
                    postfix: file.originalname ? path.extname(file.originalname) : ''
                });
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
        const directory = await unzipper.Open.file(zipPath) as CentralDirectory;
        const resolvedBase = path.resolve(outputDir);
        const extractedFiles: ExtractedFile[] = [];

        for (const entry of directory.files) {
            const basename = path.basename(entry.path);
            if (entry.type === 'Directory' || basename.startsWith('.') || JUNK_ENTRY_BASENAMES.has(basename) || entry.path.includes('__MACOSX/')) {
                continue;
            }

            const outputPath = path.join(outputDir, entry.path);
            const resolvedOutput = path.resolve(outputPath);
            if (!resolvedOutput.startsWith(resolvedBase + path.sep) && resolvedOutput !== resolvedBase) {
                logger.warn(
                    { entry: entry.path },
                    'Skipping ZIP entry with path traversal'
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
};
