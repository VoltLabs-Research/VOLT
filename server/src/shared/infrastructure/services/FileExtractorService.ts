import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { injectable } from 'tsyringe';
import unzipper from 'unzipper';
import logger from '@shared/infrastructure/logger';
import type { ExtractedFile, IFileExtractorService, UploadedFile } from '@shared/domain/port/IFileExtractorService';

/**
 * Filters out OS-generated junk entries and hidden files that should never
 * be treated as trajectory data.
 */
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

@injectable()
export default class FileExtractorService implements IFileExtractorService {
    /**
     * Extracts uploaded files (single or ZIP) to a working directory.
     *
     * ZIP extraction uses `unzipper.Open.file()` (random-access / central-directory mode)
     * instead of the streaming `unzipper.Extract()`.  The streaming parser relies on
     * **local file headers** to determine compressed-data boundaries.  When entries set
     * the "data descriptor" flag (bit 3 — `compressed_size = 0` in the local header),
     * the streaming parser must guess where each entry ends, which is unreliable for
     * large deflate entries.  This causes `Z_BUF_ERROR: unexpected end of file` because
     * zlib receives truncated compressed data.
     *
     * `Open.file()` reads the **central directory** at the end of the ZIP first, which
     * always contains the correct `compressed_size`.  It then seeks to exact byte offsets
     * for each entry, guaranteeing correct decompression regardless of file size.
     */
    public async extractFiles(files: UploadedFile[], workingDir: string): Promise<ExtractedFile[]> {
        const finalFiles: ExtractedFile[] = [];

        for (const file of files) {
            const isZip = file.mimetype === 'application/zip' || file.originalname?.endsWith('.zip');

            if (isZip) {
                let zipPath = file.path;
                let tempZipCreated = false;

                if (!zipPath && file.buffer) {
                    zipPath = path.join(workingDir, `upload_${Date.now()}_${Math.random().toString(36).substring(7)}.zip`);
                    await fs.writeFile(zipPath, file.buffer);
                    tempZipCreated = true;
                }

                if (zipPath) {
                    await this.extractZipViaOpenFile(zipPath, workingDir);

                    const extracted = await this.getFilesRecursive(workingDir);
                    for (const fullPath of extracted) {
                        const filename = path.basename(fullPath);
                        if (filename.endsWith('.zip') || isJunkEntry(fullPath)) {
                            continue;
                        }
                        const stats = await fs.stat(fullPath);
                        if (stats.size === 0) continue;
                        finalFiles.push({
                            path: fullPath,
                            originalname: filename,
                            size: stats.size
                        });
                    }

                    if (tempZipCreated) {
                        await fs.unlink(zipPath).catch(() => {});
                    }
                }
            } else {
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
        }

        return finalFiles;
    }

    /**
     * Extracts a ZIP archive using the central-directory-based approach.
     *
     * Each entry is extracted sequentially to keep memory usage bounded —
     * only one entry is decompressed at a time.  The entry stream is piped
     * through Node's stream pipeline which handles backpressure correctly
     * and ensures the write stream is closed before moving to the next entry.
     */
    private async extractZipViaOpenFile(zipPath: string, outputDir: string): Promise<void> {
        const directory = await unzipper.Open.file(zipPath);

        logger.info(
            { zipPath, entryCount: directory.files.length },
            '@file-extractor: opened ZIP via central directory'
        );

        for (const entry of directory.files) {
            if (entry.type === 'Directory') continue;
            if (isJunkEntry(entry.path)) {
                continue;
            }

            const outputPath = path.join(outputDir, entry.path);
            const outputDirForEntry = path.dirname(outputPath);

            // Guard against zip-slip (path traversal)
            const resolvedOutput = path.resolve(outputPath);
            const resolvedBase = path.resolve(outputDir);
            if (!resolvedOutput.startsWith(resolvedBase + path.sep) && resolvedOutput !== resolvedBase) {
                logger.warn(
                    { entry: entry.path },
                    '@file-extractor: skipping entry with path traversal'
                );
                continue;
            }

            await fs.mkdir(outputDirForEntry, { recursive: true });

            const readStream = entry.stream();
            const writeStream = createWriteStream(outputPath);

            await pipeline(readStream, writeStream);
        }

        logger.info(
            { zipPath, entryCount: directory.files.length },
            '@file-extractor: ZIP extraction complete'
        );
    }

    public async getFilesRecursive(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? this.getFilesRecursive(res) : res;
        }));
        return Array.prototype.concat(...files);
    }
};
