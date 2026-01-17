import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO } from '../../dtos/plugin/UpdatePluginByIdDTO';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';
import { PluginStatus } from '../../../domain/entities/Plugin';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';

@injectable()
export class UpdatePluginByIdUseCase implements IUseCase<UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO> {
    constructor(
        @inject('IPluginRepository') private pluginRepository: IPluginRepository
    ) { }

    async execute(input: UpdatePluginByIdInputDTO): Promise<Result<UpdatePluginByIdOutputDTO>> {
        const plugin = await this.pluginRepository.updateById(input.pluginId, {
            workflow: input.workflow,
            status: input.status as PluginStatus
        });

        if(!plugin){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        return Result.ok(plugin.props);
    }
}
