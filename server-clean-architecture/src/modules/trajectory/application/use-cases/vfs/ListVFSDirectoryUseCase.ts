import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { ListVFSDirectoryInputDTO, ListVFSDirectoryOutputDTO } from '@modules/trajectory/application/dtos/vfs/VFSDTOs';

export interface IVFSService {
    listDirectory(trajectoryId: string, path?: string): Promise<any[]>;
}

@injectable()
export class ListVFSDirectoryUseCase implements IUseCase<ListVFSDirectoryInputDTO, ListVFSDirectoryOutputDTO> {
    constructor(
        @inject('IVFSService') private vfsService: IVFSService
    ) { }

    async execute(input: ListVFSDirectoryInputDTO): Promise<Result<ListVFSDirectoryOutputDTO>> {
        const files = await this.vfsService.listDirectory(input.trajectoryId, input.path);
        return Result.ok({ files });
    }
}
