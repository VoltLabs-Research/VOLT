import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ExportPluginInputDTO, ExportPluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ExportPluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { IPluginStorageService } from '@modules/plugin/domain/port/IPluginStorageService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { createStreamResponse } from '@modules/plugin/application/helpers/create-download-response';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';

@injectable()
export class ExportPluginUseCase implements IUseCase<ExportPluginInputDTO, ExportPluginOutputDTO, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginStorageService) private storageService: IPluginStorageService
    ){}

    async execute(input: ExportPluginInputDTO): Promise<Result<ExportPluginOutputDTO, ApplicationError>> {
        const plugin = await this.pluginRepository.findById(input.pluginId);

        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        const fileName = `${plugin._id}.zip`;
        const stream = await this.storageService.exportPlugin(input.pluginId);

        return Result.ok({
            ...createStreamResponse({
                stream,
                contentType: 'application/zip',
                filename: fileName
            }),
            fileName
        });
    }
}
