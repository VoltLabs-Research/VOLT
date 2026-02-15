import { injectable } from 'tsyringe';
import { ITempFileService, TempFileOptions, DeleteOptions } from '@shared/domain/ports/ITempFileService';
import { v4 } from 'uuid';
import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class TempFileService implements ITempFileService{
    private readonly TEMP_DIR: string;
    
    constructor(){
        this.TEMP_DIR = path.resolve(process.cwd(), 'storage/temp');
        this.initialize();
    }

    private async initialize(){
        try{
            await this.ensureDir(this.TEMP_DIR);
        }catch(error){
            logger.error(`@temp-file-manager: failed to initialize root temp dir: ${error}`);
        }
    }

    get rootPath(): string{
        return this.TEMP_DIR;
    }

    async ensureDir(dirPath: string): Promise<void>{
        try{
            await fs.mkdir(dirPath, { recursive: true });
        }catch(error: any){
            if(error.code !== 'EEXIST'){
                throw error;
            }
        }
    }

    generateFilePath(options: TempFileOptions): string{
        const { prefix = 'temp_', extension = '', subdir } = options;
        const filename = `${prefix}${v4()}${extension}`;
        
        let dirPath = this.TEMP_DIR;
        if(subdir){
            dirPath = path.join(this.TEMP_DIR, subdir);
        }

        return path.join(dirPath, filename);
    }

    getDirPath(subdir: string): string{
        return path.join(this.TEMP_DIR, subdir);
    }

    async delete(targetPath: string, options?: DeleteOptions): Promise<boolean>{
        try{
            // Ensure path is within temp dir to prevent accidental deletions!
            const resolvedPath = path.resolve(targetPath);
            if(!resolvedPath.startsWith(this.TEMP_DIR)){
                logger.warn(`@temp-file-manager: refusing to delete path outside temp dir: ${resolvedPath}`);
                return false;
            }

            await fs.rm(targetPath, {
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