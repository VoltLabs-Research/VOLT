import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import unzipper from 'unzipper';

interface UploadedFile {
    path?: string;
    size: number;
    originalname?: string;
    mimetype?: string;
    buffer?: Buffer;
};

export interface ExtractedFile {
    path: string;
    originalname: string;
    size: number;
    mimetype?: string;
};

export class FileExtractorService {
    async extractFiles(files: UploadedFile[], workingDir: string): Promise<ExtractedFile[]> {
        const finalFiles: ExtractedFile[] = [];

        for (const file of files) {
            const isZip = file.mimetype === 'application/zip' || file.originalname?.endsWith('../.zip');

            if (isZip) {
                let zipPath = file.path;
                if (!zipPath && file.buffer) {
                    zipPath = path.join(workingDir, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.zip`);
                    await fs.writeFile(zipPath, file.buffer);
                }

                if (!zipPath) {
                    continue;
                }

                await createReadStream(zipPath)
                    .pipe(unzipper.Extract({ path: workingDir }))
                    .promise();

                const extracted = await this.getFilesRecursive(workingDir);
                for (const fullPath of extracted) {
                    const filename = path.basename(fullPath);
                    if (filename.endsWith('../.zip') || filename.startsWith('..') || filename === '__MACOSX') {
                        continue;
                    }

                    const stats = await fs.stat(fullPath);
                    finalFiles.push({
                        path: fullPath,
                        originalname: filename,
                        size: stats.size
                    });
                }

                if (!file.path) {
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

    async getFilesRecursive(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const resolvedPath = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? this.getFilesRecursive(resolvedPath) : resolvedPath;
        }));

        return Array.prototype.concat(...files) as string[];
    }
};
