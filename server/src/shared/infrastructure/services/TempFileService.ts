import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '@shared/infrastructure/logger';
import { injectable } from 'tsyringe';
import { v4 } from 'uuid';
import type { DeleteOptions, ITempFileService, TempFileOptions } from '@shared/domain/port/ITempFileService';

@injectable()
export default class TempFileService implements ITempFileService{
    private readonly TEMP_DIR: string;
    
    constructor(){
        this.TEMP_DIR = path.resolve(process.cwd(), 'storage/temp');
        try{
            fsSync.mkdirSync(this.TEMP_DIR, { recursive: true });
        }catch(error){
            logger.error(`@temp-file-manager: failed to initialize root temp dir: ${String(error)}`);
        }
    }

    private isWithinTempDir(targetPath: string): boolean {
        const relativePath = path.relative(this.TEMP_DIR, targetPath);

        return relativePath !== ''
            ? !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
            : true;
    }

    private resolveWithinTempDir(...pathSegments: string[]): string {
        const resolvedPath = path.resolve(this.TEMP_DIR, ...pathSegments);

        if (!this.isWithinTempDir(resolvedPath)) {
            throw new Error(`Invalid temp path: ${resolvedPath}`);
        }

        return resolvedPath;
    }

    private normalizePrefix(prefix: string): string {
        return prefix.replace(/[^a-zA-Z0-9_-]+/g, '_');
    }

    private normalizeExtension(extension: string): string {
        if (!extension) {
            return '';
        }

        return extension.startsWith('.')
            ? extension
            : `.${extension}`;
    }

    get rootPath(): string{
        return this.TEMP_DIR;
    }

    async ensureDir(dirPath: string): Promise<void>{
        await fs.mkdir(dirPath, { recursive: true });
    }

    generateFilePath(options: TempFileOptions): string{
        const { prefix = 'temp_', extension = '', subdir } = options;
        const filename = `${this.normalizePrefix(prefix)}${v4()}${this.normalizeExtension(extension)}`;
        const dirPath = subdir
            ? this.resolveWithinTempDir(subdir)
            : this.TEMP_DIR;

        return path.join(dirPath, filename);
    }

    getDirPath(subdir: string): string{
        return this.resolveWithinTempDir(subdir);
    }

    async delete(targetPath: string, options?: DeleteOptions): Promise<boolean>{
        try{
            const resolvedPath = path.resolve(targetPath);
            if(!this.isWithinTempDir(resolvedPath)){
                logger.warn(`@temp-file-manager: refusing to delete path outside temp dir: ${resolvedPath}`);
                return false;
            }

            await fs.rm(resolvedPath, {
                recursive: options?.recursive ?? false,
                force: options?.force ?? true
            });
            return true;
        }catch(error){
            logger.debug(`@temp-file-manager: failed to delete ${targetPath}: ${error}`);
            return false;
        }
    }
};
