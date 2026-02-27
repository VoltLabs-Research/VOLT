import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ISecretKeyRepository } from '@modules/team/domain/ports/ISecretKeyRepository';
import {
    ListSecretKeysByTeamIdInputDTO,
    ListSecretKeysByTeamIdOutputDTO,
    SecretKeyListItemDTO
} from '@modules/team/application/dtos/secret-key/ListSecretKeysByTeamIdDTO';

@injectable()
export default class ListSecretKeysByTeamIdUseCase implements IUseCase<ListSecretKeysByTeamIdInputDTO, ListSecretKeysByTeamIdOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository
    ) {}

    async execute(input: ListSecretKeysByTeamIdInputDTO): Promise<Result<ListSecretKeysByTeamIdOutputDTO>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(200, Number(input.limit || 50)));

        const result = await this.secretKeyRepository.findAll({
            filter: {
                team: input.teamId
            } as any,
            page,
            limit,
            sort: {
                createdAt: -1
            },
            populate: {
                path: 'role',
                select: ['name']
            }
        });

        const data = result.data.map((secretKey) => {
            const role = secretKey.props.role as any;

            return {
                _id: secretKey.id,
                teamId: String(secretKey.props.team),
                roleId: role?._id?.toString?.() || String(secretKey.props.role),
                roleName: role?.name || 'Unknown',
                name: secretKey.props.name,
                keyPrefix: secretKey.props.keyPrefix,
                isActive: secretKey.props.isActive,
                lastUsedAt: secretKey.props.lastUsedAt,
                createdAt: secretKey.props.createdAt,
                updatedAt: secretKey.props.updatedAt
            } as SecretKeyListItemDTO;
        });

        return Result.ok({
            ...result,
            data
        });
    }
}
