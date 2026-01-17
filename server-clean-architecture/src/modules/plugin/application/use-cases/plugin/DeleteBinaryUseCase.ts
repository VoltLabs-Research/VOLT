import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';
import { DeleteBinaryInputDTO } from '../../dtos/plugin/DeleteBinaryDTO';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';

@injectable()
export class DeleteBinaryUseCase implements IUseCase<DeleteBinaryInputDTO, null, ApplicationError> {
    constructor(
        @inject('IPluginRepository') private pluginRepository: IPluginRepository,
    ){}

    async execute(input: DeleteBinaryInputDTO): Promise<Result<null, ApplicationError>> {
        const plugin = await this.pluginRepository.deleteById(input.pluginId);
        if(!plugin){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        return Result.ok(null);
    }
}
