import {
    GenerateTeamClusterInstallManifestInputDTO,
    GenerateTeamClusterInstallManifestOutputDTO
} from '@modules/team-cluster/application/dtos/GenerateTeamClusterInstallManifestDTO';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterInstallManifestService from '@modules/team-cluster/infrastructure/services/TeamClusterInstallManifestService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
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
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterInstallManifestService)
        private readonly teamClusterInstallManifestService: TeamClusterInstallManifestService
    ){}

    async execute(input: GenerateTeamClusterInstallManifestInputDTO): Promise<Result<GenerateTeamClusterInstallManifestOutputDTO, ApplicationError>> {
        try {
            const manifest = await this.teamClusterInstallManifestService.generateInstallManifest(
                input.teamClusterId,
                input.daemonPassword,
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
