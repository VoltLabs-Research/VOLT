import { ExportPluginInputDTO, ExportPluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ExportPluginDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

import { ErrorCodes } from '@core/constants/error-codes';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import PluginStorageService from '@modules/plugin/infrastructure/services/plugin/PluginStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

@Singleton()
export class ExportPluginUseCase implements IUseCase<ExportPluginInputDTO, ExportPluginOutputDTO, ApplicationError> {
    constructor(
        private pluginRepository: PluginRepository,
        private storageService: PluginStorageService
    ) {}

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
}
