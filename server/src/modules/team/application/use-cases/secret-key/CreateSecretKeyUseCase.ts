import crypto from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ISecretKeyRepository } from '@modules/team/domain/ports/ISecretKeyRepository';
import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    CreateSecretKeyInputDTO,
    CreateSecretKeyOutputDTO
} from '@modules/team/application/dtos/secret-key/CreateSecretKeyDTO';

@injectable()
export default class CreateSecretKeyUseCase implements IUseCase<CreateSecretKeyInputDTO, CreateSecretKeyOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository,

        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository
    ) {}

    async execute(input: CreateSecretKeyInputDTO): Promise<Result<CreateSecretKeyOutputDTO, ApplicationError>> {
        const { teamId, roleId, name, userId } = input;

        if (!userId) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                ErrorCodes.AUTHENTICATION_REQUIRED
            ));
        }

        if (!teamId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_ID_REQUIRED,
                'Team ID is required'
            ));
        }

        if (!roleId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.SECRET_KEY_ROLE_REQUIRED,
                'Role ID is required'
            ));
        }

        if (!name?.trim()) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.SECRET_KEY_NAME_REQUIRED,
                'Secret key name is required'
            ));
        }

        const role = await this.teamRoleRepository.findOne({
            _id: roleId,
            team: teamId
        } as any);

        if (!role) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            ));
        }

        const tokenSuffix = crypto.randomBytes(32).toString('hex');
        const secretKey = `vsk_${tokenSuffix}`;
        const keyPrefix = secretKey.slice(0, 14);
        const keyHash = crypto.createHash('sha256')
            .update(secretKey)
            .digest('hex');

        const created = await this.secretKeyRepository.create({
            team: teamId,
            role: roleId,
            name: name.trim(),
            keyPrefix,
            keyHash,
            createdBy: userId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok({
            secretKeyId: created.id,
            teamId,
            roleId,
            name: created.props.name,
            keyPrefix: created.props.keyPrefix,
            secretKey,
            isActive: created.props.isActive,
            createdAt: created.props.createdAt
        });
    }
}
