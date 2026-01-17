import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { DeletePluginByIdInputDTO } from '../../dtos/plugin/DeletePluginByIdDTO';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';

@injectable()
export class DeletePluginByIdUseCase implements IUseCase<DeletePluginByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject('IPluginRepository') private pluginRepository: IPluginRepository,
        @inject('IEventBus') private eventBus: IEventBus
    ) { }

    async execute(input: DeletePluginByIdInputDTO): Promise<Result<null, ApplicationError>> {
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
