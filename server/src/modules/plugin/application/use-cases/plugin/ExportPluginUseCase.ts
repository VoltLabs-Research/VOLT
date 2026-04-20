import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ExportPluginInputDTO, ExportPluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ExportPluginDTO';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';

import { ErrorCodes } from '@core/constants/error-codes';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationError';

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
            ...createDownloadStreamResponse({
                stream,
                contentType: 'application/zip',
                filename: fileName
            }),
            fileName
        });
    }
};
