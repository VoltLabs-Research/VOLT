import { ROLE_POPULATE, USER_POPULATE } from '@shared/application/PopulatePresets';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ListSecretKeysByTeamIdInputDTO, ListSecretKeysByTeamIdOutputDTO, SecretKeyListItemDTO } from '@modules/team/application/dtos/secret-key/ListSecretKeysByTeamIdDTO';
import { ISecretKeyRepository } from '@modules/team/domain/port/secret-key/ISecretKeyRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class ListSecretKeysByTeamIdUseCase implements IUseCase<ListSecretKeysByTeamIdInputDTO, ListSecretKeysByTeamIdOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository
    ) {}

    async execute(input: ListSecretKeysByTeamIdInputDTO): Promise<Result<ListSecretKeysByTeamIdOutputDTO>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(200, input.limit ?? 50));

        const result = await this.secretKeyRepository.findAll({
            filter: {
                team: input.teamId
            },
            page,
            limit,
            sort: {
                createdAt: -1
            },
            populate: [
                ROLE_POPULATE,
                USER_POPULATE
            ]
        });

        const data = result.data.map((secretKey) => {
            return {
                _id: secretKey._id,
                teamId: String(secretKey.props.team),
                roleId: secretKey.getRoleId(),
                roleName: secretKey.getRoleName(),
                name: secretKey.props.name,
                keyPrefix: secretKey.props.keyPrefix,
                createdBy: secretKey.props.createdBy,
                isActive: secretKey.props.isActive,
                lastUsedAt: secretKey.props.lastUsedAt,
                createdAt: secretKey.props.createdAt,
                updatedAt: secretKey.props.updatedAt
            } satisfies SecretKeyListItemDTO;
        });

        return Result.ok({
            ...result,
            data
        });
    }
};
