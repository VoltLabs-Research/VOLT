import type { FileWithPath } from '@/hooks/trajectory/use-trajectory-upload';
import Logger from '@/services/logger';

export const extractFolderName = (fullPath: string): string | null => {
    if(!fullPath) return null;
    const pathParts = fullPath.split('/').filter((part) => part.trim() !== '');
    return pathParts.length > 0 ? pathParts[0] : null;
};

export const processFileSystemEntry = async(entry: any): Promise<{ files: FileWithPath[], folderName: string | null }> => {
    const logger = new Logger('process-file-system-entry');
    const files: FileWithPath[] = [];
    let folderName: string | null = null;

    const processEntry = async(currentEntry: any): Promise<void> =>{
        if(currentEntry.isFile){
            try{
                const file = await new Promise<File>((resolve, reject) => {
                    currentEntry.file(resolve, reject);
                });

                const relativePath = currentEntry.fullPath.startsWith('/')
                    ? currentEntry.fullPath.slice(1)
                    : currentEntry.fullPath;

                files.push({ file, path: relativePath });

                if(!folderName){
                    folderName = extractFolderName(currentEntry.fullPath);
                }
            }catch(err: any){
                logger.error(`Error processing file: ${currentEntry.fullPath}`, err);
            }
        }else if(currentEntry.isDirectory){
            if(!folderName){
                folderName = extractFolderName(currentEntry.fullPath);
            }

            try{
                const dirReader = currentEntry.createReader();
                const entries = await new Promise<any[]>((resolve, reject) => {
                    dirReader.readEntries(resolve, reject);
                });

                await Promise.all(entries.map((subEntry) => processEntry(subEntry)));
            }catch(err){
                logger.error(`Error reading directory: ${currentEntry.fullPath}`, err);
            }
        }
    };

    await processEntry(entry);
    return { files, folderName };
};
