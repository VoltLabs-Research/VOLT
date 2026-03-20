import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { injectable } from 'tsyringe';
import unzipper from 'unzipper';
import pLimit from 'p-limit';
import logger from '@shared/infrastructure/logger';
import type { ExtractedFile, IFileExtractorService, UploadedFile } from '@shared/domain/port/IFileExtractorService';

/**
 * How many ZIP entries to decompress in parallel.
 * Each inflating entry holds ~256 KB of zlib buffers plus the write stream,
 * so 4 concurrent entries keeps peak memory around 1 MB of zlib overhead
 * while overlapping CPU decompression with disk I/O.
 */
const ZIP_EXTRACTION_CONCURRENCY = 4;

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

const resolvePathWithinBase = (baseDir: string, targetPath: string): string | null => {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(baseDir, targetPath);

    if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
        return null;
    }

    return resolvedTarget;
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
     *
     * Entries are decompressed with bounded concurrency (default 4) to overlap
     * CPU-bound inflate work with disk I/O, without exhausting memory.
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
                    const extracted = await this.extractZipViaOpenFile(zipPath, workingDir);
                    finalFiles.push(...extracted);

                    if (tempZipCreated) {
                        await fs.unlink(zipPath).catch(() => {});
                    }
                }
            } else {
                if (!file.path && file.buffer) {
                    const targetName = file.originalname || `upload_${Date.now()}`;
                    const tempPath = resolvePathWithinBase(workingDir, targetName);

                    if (!tempPath) {
                        logger.warn(
                            { originalname: file.originalname },
                            '@file-extractor: skipping buffered file with path traversal'
                        );
                        continue;
                    }

                    await fs.mkdir(path.dirname(tempPath), { recursive: true });
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
     * Extracts a ZIP archive using the central-directory-based approach with
     * bounded parallel decompression.
     *
     * `Open.file()` gives each entry an independent read stream positioned at
     * the exact byte offset from the central directory, so multiple entries can
     * be inflated concurrently without interfering with each other.
     *
     * Returns the list of extracted files directly, avoiding a costly
     * recursive directory scan + stat pass after extraction.
     */
    private async extractZipViaOpenFile(zipPath: string, outputDir: string): Promise<ExtractedFile[]> {
        const directory = await unzipper.Open.file(zipPath);
        const limit = pLimit(ZIP_EXTRACTION_CONCURRENCY);

        logger.info(
            { zipPath, entryCount: directory.files.length },
            '@file-extractor: opened ZIP via central directory'
        );

        // Pre-collect the unique parent directories so concurrent entries
        // don't race on mkdir for the same path.
        const dirsToCreate = new Set<string>();
        for (const entry of directory.files) {
            if (entry.type === 'Directory' || isJunkEntry(entry.path)) continue;
            const resolvedOutput = resolvePathWithinBase(outputDir, entry.path);

            if (!resolvedOutput) {
                logger.warn(
                    { entry: entry.path },
                    '@file-extractor: skipping entry with path traversal'
                );
                continue;
            }

            dirsToCreate.add(path.dirname(resolvedOutput));
        }
        await Promise.all(
            [...dirsToCreate].map((dir) => fs.mkdir(dir, { recursive: true }))
        );

        const tasks = directory.files.map((entry) =>
            limit(async (): Promise<ExtractedFile | null> => {
                if (entry.type === 'Directory') return null;
                if (isJunkEntry(entry.path)) return null;

                const resolvedOutput = resolvePathWithinBase(outputDir, entry.path);
                if (!resolvedOutput) {
                    logger.warn(
                        { entry: entry.path },
                        '@file-extractor: skipping entry with path traversal'
                    );
                    return null;
                }

                await pipeline(entry.stream(), createWriteStream(resolvedOutput));

                const stats = await fs.stat(resolvedOutput);
                if (stats.size === 0) return null;

                return {
                    path: resolvedOutput,
                    originalname: path.basename(entry.path),
                    size: stats.size
                };
            })
        );

        const results = await Promise.all(tasks);
        const extracted = results.filter((r): r is ExtractedFile => r !== null);

        logger.info(
            { zipPath, extractedCount: extracted.length },
            '@file-extractor: ZIP extraction complete'
        );

        return extracted;
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
