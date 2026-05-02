import {
    GenerateTeamClusterInstallManifestInputDTO,
    GenerateTeamClusterInstallManifestOutputDTO
} from '@modules/cluster/application/dtos/GenerateTeamClusterInstallManifestDTO';
import TeamClusterInstallManifestService from '@modules/cluster/infrastructure/services/TeamClusterInstallManifestService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GenerateTeamClusterInstallManifestUseCase implements IUseCase<
    GenerateTeamClusterInstallManifestInputDTO,
    GenerateTeamClusterInstallManifestOutputDTO,
    ApplicationError
> {
    constructor(
        private readonly teamClusterInstallManifestService: TeamClusterInstallManifestService
    ){}

    async execute(input: GenerateTeamClusterInstallManifestInputDTO): Promise<Result<GenerateTeamClusterInstallManifestOutputDTO, ApplicationError>> {
        try {
            const manifest = await this.teamClusterInstallManifestService.generateInstallManifest(
                input.teamClusterId,
                input.daemonPassword,
                input.installRoot,
                input.ports
            );

            return Result.ok({
                manifest
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.internalServerError('Failed to generate team cluster install manifest'));
        }
    }
};
