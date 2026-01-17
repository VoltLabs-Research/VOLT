import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { DeleteVFSFileOutputDTO } from '../../dtos/vfs/VFSDTOs';

export interface IVFSService {
    deleteFile(trajectoryId: string, path: string): Promise<void>;
}

interface DeleteVFSFileInputDTO {
    trajectoryId: string;
    path: string;
}

@injectable()
export class DeleteVFSFileUseCase implements IUseCase<DeleteVFSFileInputDTO, DeleteVFSFileOutputDTO> {
    constructor(
        @inject('IVFSService') private vfsService: IVFSService
    ) { }

    async execute(input: DeleteVFSFileInputDTO): Promise<Result<DeleteVFSFileOutputDTO>> {
        await this.vfsService.deleteFile(input.trajectoryId, input.path);
        return Result.ok({ message: 'File deleted successfully' });
    }
}
