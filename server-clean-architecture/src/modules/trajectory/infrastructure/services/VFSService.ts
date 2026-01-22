import { injectable, inject } from 'tsyringe';
import { IStorageService } from '@shared/domain/ports/IStorageService';

@injectable()
export class VFSService {
    constructor(
        @inject('IStorageService') private storage: IStorageService
    ){}

    async listDirectory(trajectoryId: string, path: string = ''): Promise<any[]> {
        const basePath = `trajectory/${trajectoryId}/vfs/${path}`;
        const files: any[] = [];


        for await (const key of this.storage.listByPrefix('trajectories', basePath)) {
            try {
                const metadata = await this.storage.getStat('trajectories', key);
                files.push({
                    name: key.split('/').pop(),
                    type: 'file', // Can't easily determine directory without suffix
                    size: metadata.size
                });
            } catch (e) {
                // ignore missing files
            }
        }
        return files;
    }

    async getFile(trajectoryId: string, path: string): Promise<Buffer> {
        const filePath = `trajectory/${trajectoryId}/vfs/${path}`;
        return await this.storage.getBuffer('trajectories', filePath);
    }

    async uploadFile(trajectoryId: string, path: string, buffer: Buffer): Promise<string> {
        const filePath = `trajectory/${trajectoryId}/vfs/${path}`;
        await this.storage.upload('trajectories', filePath, buffer);
        return filePath;
    }

    async deleteFile(trajectoryId: string, path: string): Promise<void> {
        const filePath = `trajectory/${trajectoryId}/vfs/${path}`;
        await this.storage.delete('trajectories', filePath);
    }

    async downloadArchive(trajectoryId: string): Promise<any> {
        throw new Error("Method not implemented.");
    }
}
