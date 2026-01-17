import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { DownloadVFSArchiveOutputDTO } from '../../dtos/vfs/VFSDTOs';

export interface IVFSService {
    downloadArchive(trajectoryId: string): Promise<any>;
}

@injectable()
export class DownloadVFSArchiveUseCase implements IUseCase<string, DownloadVFSArchiveOutputDTO> {
    constructor(
        @inject('IVFSService') private vfsService: IVFSService
    ) { }

    async execute(trajectoryId: string): Promise<Result<DownloadVFSArchiveOutputDTO>> {
        const stream = await this.vfsService.downloadArchive(trajectoryId);

        return Result.ok({
            stream,
            fileName: `trajectory-${trajectoryId}-vfs.zip`
        });
    }
}
