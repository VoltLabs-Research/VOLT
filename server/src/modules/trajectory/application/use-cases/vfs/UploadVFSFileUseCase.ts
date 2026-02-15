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
        const fileBuffer = input.file?.buffer || input.fileBuffer || Buffer.from([]);
        const uploadPath = input.path || '';

        const storedPath = await this.vfsService.uploadFile(
            input.trajectoryId,
            uploadPath,
            fileBuffer
        );

        return Result.ok({
            message: 'File uploaded successfully',
            path: storedPath
        });
    }
}
