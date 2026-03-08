import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import ListSecretKeysByTeamIdUseCase from '@modules/team/application/use-cases/secret-key/ListSecretKeysByTeamIdUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import type { TeamAIToolListResult } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import type { SecretKeyListItemDTO } from '@modules/team/application/dtos/secret-key/ListSecretKeysByTeamIdDTO';

const listSecretKeysParametersSchema = z.object({});

@injectable()
export class ListSecretKeysAITool extends TeamUseCaseAITool<
    z.infer<typeof listSecretKeysParametersSchema>,
    ListSecretKeysByTeamIdUseCase,
    typeof listSecretKeysParametersSchema,
    TeamAIToolListResult<SecretKeyListItemDTO[]>
> {
    readonly name = 'list_secret_keys';
    readonly description = 'List API secret keys for the selected team.';
    readonly parameters = listSecretKeysParametersSchema;

    constructor(
        @inject(ListSecretKeysByTeamIdUseCase)
        useCase: ListSecretKeysByTeamIdUseCase
    ) {
        super(
            useCase,
            (_, scope) => ({
                teamId: scope.teamId,
                page: 1,
                limit: 100
            }),
            (output) => ({
                summary: `Found ${output.data.length} secret keys.`,
                data: output.data
            })
        );
    }
};
