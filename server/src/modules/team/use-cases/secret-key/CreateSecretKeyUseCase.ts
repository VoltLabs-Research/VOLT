import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import type { ISecretKeyRepository } from '@modules/team/ports/secret-key/ISecretKeyRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { CreateSecretKeyInputDTO, CreateSecretKeyOutputDTO } from '@modules/team/dtos/secret-key/CreateSecretKeyDTO';
import SecretKeyCreatedEvent from '@modules/team/events/secret-key/SecretKeyCreatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import crypto from 'node:crypto';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CreateSecretKeyUseCase implements IUseCase<CreateSecretKeyInputDTO, CreateSecretKeyOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepository: ISecretKeyRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CreateSecretKeyInputDTO): Promise<CreateSecretKeyOutputDTO> {
        const { teamId, roleId, name, userId } = input;

        const role = await this.teamRoleRepository.findById(roleId);

        if (!role || role.props.team !== teamId) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            );
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

        return {
            secretKeyId: created._id,
            teamId,
            roleId,
            name: created.props.name,
            keyPrefix: created.props.keyPrefix,
            secretKey,
            isActive: created.props.isActive,
            createdAt: created.props.createdAt
        };
    }
}
