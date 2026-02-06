import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { UploadVFSFileInputDTO, UploadVFSFileOutputDTO } from '@modules/trajectory/application/dtos/vfs/VFSDTOs';

export interface IVFSService {
    uploadFile(trajectoryId: string, path: string, buffer: Buffer): Promise<string>;
}

@injectable()
export class UploadVFSFileUseCase implements IUseCase<UploadVFSFileInputDTO, UploadVFSFileOutputDTO> {
    constructor(
        @inject('IVFSService') private vfsService: IVFSService
    ){}

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
