import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { ExportPluginInputDTO, ExportPluginOutputDTO } from '../../dtos/plugin/ExportPluginDTO';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';
import { IPluginStorageService } from '../../../domain/ports/IPluginStorageService';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';

@injectable()
export class ExportPluginUseCase implements IUseCase<ExportPluginInputDTO, ExportPluginOutputDTO, ApplicationError> {
    constructor(
        @inject('IPluginRepository') private pluginRepository: IPluginRepository,
        @inject('IPluginStorageService') private storageService: IPluginStorageService
    ){}

    async execute(input: ExportPluginInputDTO): Promise<Result<ExportPluginOutputDTO, ApplicationError>>{
        const plugin = await this.pluginRepository.findById(input.pluginId);

        if(!plugin){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        const stream = await this.storageService.exportPlugin(input.pluginId);

        return Result.ok({
            stream,
            fileName: `${plugin.props.slug}.zip`
        });
    }
}
