import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ExportPluginInputDTO, ExportPluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ExportPluginDTO';
import type { IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';

@Singleton()
export class ExportPluginUseCase implements IUseCase<ExportPluginInputDTO, ExportPluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginStorageService) private readonly storageService: IPluginStorageService
    ) {}

    async execute(input: ExportPluginInputDTO): Promise<ExportPluginOutputDTO> {
        const plugin = await this.pluginRepository.findById(input.pluginId);

        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const fileName = `${plugin._id}.zip`;
        const stream = await this.storageService.exportPlugin(input.pluginId);

        return {
            ...createDownloadStreamResponse({
                stream,
                contentType: 'application/zip',
                filename: fileName
            }),
            fileName
        };
    }
}
