import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { UploadVFSFileInputDTO, UploadVFSFileOutputDTO } from '../../dtos/vfs/VFSDTOs';

export interface IVFSService {
    uploadFile(trajectoryId: string, path: string, buffer: Buffer): Promise<string>;
}

@injectable()
export class UploadVFSFileUseCase implements IUseCase<UploadVFSFileInputDTO, UploadVFSFileOutputDTO> {
    constructor(
        @inject('IVFSService') private vfsService: IVFSService
    ) { }

    async execute(input: UploadVFSFileInputDTO): Promise<Result<UploadVFSFileOutputDTO>> {
        const path = await this.vfsService.uploadFile(
            input.trajectoryId,
            input.path,
            input.fileBuffer
        );

        return Result.ok({
            message: 'File uploaded successfully',
            path
        });
    }
}
