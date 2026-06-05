import type TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import type SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { CreateSecretKeyInputDTO, CreateSecretKeyOutputDTO } from '@modules/team/application/dtos/secret-key/CreateSecretKeyDTO';
import SecretKeyCreatedEvent from '@modules/team/domain/events/secret-key/SecretKeyCreatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import crypto from 'node:crypto';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CreateSecretKeyUseCase implements IUseCase<CreateSecretKeyInputDTO, CreateSecretKeyOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepository: SecretKeyRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: TeamRoleRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CreateSecretKeyInputDTO): Promise<Result<CreateSecretKeyOutputDTO, ApplicationError>> {
        const { teamId, roleId, name, userId } = input;

        const role = await this.teamRoleRepository.findById(roleId);

        if (!role || role.props.team !== teamId) {
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
            name,
            keyPrefix,
            keyHash,
            createdBy: userId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await this.eventBus.publish(new SecretKeyCreatedEvent({
            secretKeyId: created._id,
            teamId,
            name: created.props.name,
            userId
        }));

        return Result.ok({
            secretKeyId: created._id,
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
