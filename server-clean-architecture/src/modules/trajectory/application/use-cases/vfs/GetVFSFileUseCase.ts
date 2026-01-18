import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetVFSFileInputDTO } from '@modules/trajectory/application/dtos/vfs/VFSDTOs';

export interface IVFSService {
    getFile(trajectoryId: string, path: string): Promise<Buffer>;
}

@injectable()
export class GetVFSFileUseCase implements IUseCase<GetVFSFileInputDTO, Buffer> {
    constructor(
        @inject('IVFSService') private vfsService: IVFSService
    ){}

    async execute(input: GetVFSFileInputDTO): Promise<Result<Buffer>> {
        const fileBuffer = await this.vfsService.getFile(input.trajectoryId, input.path);
        return Result.ok(fileBuffer);
    }
}
