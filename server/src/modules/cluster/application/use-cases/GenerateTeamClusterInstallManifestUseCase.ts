import {
    GenerateTeamClusterInstallManifestInputDTO,
    GenerateTeamClusterInstallManifestOutputDTO
} from '@modules/cluster/application/dtos/GenerateTeamClusterInstallManifestDTO';
import type { ITeamClusterInstallManifestService } from '@modules/cluster/domain/port/ITeamClusterInstallManifestService';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GenerateTeamClusterInstallManifestUseCase implements IUseCase<
    GenerateTeamClusterInstallManifestInputDTO,
    GenerateTeamClusterInstallManifestOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterInstallManifestService) private readonly teamClusterInstallManifestService: ITeamClusterInstallManifestService
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
