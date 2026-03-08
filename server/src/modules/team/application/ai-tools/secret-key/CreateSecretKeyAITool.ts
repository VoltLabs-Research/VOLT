import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import CreateSecretKeyUseCase from '@modules/team/application/use-cases/secret-key/CreateSecretKeyUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

const createSecretKeyParametersSchema = z.object({
    name: z.string(),
    roleId: z.string(),
    reason: z.string().optional()
});

@injectable()
export class CreateSecretKeyAITool extends TeamUseCaseAITool<
    z.infer<typeof createSecretKeyParametersSchema>,
    CreateSecretKeyUseCase,
    typeof createSecretKeyParametersSchema
> {
    readonly name = 'create_secret_key';
    readonly description = 'Create a new API secret key.';
    readonly parameters = createSecretKeyParametersSchema;

    constructor(
        @inject(CreateSecretKeyUseCase)
        useCase: CreateSecretKeyUseCase
    ) {
        super(
            useCase,
            (params, scope) => ({
                teamId: scope.teamId,
                userId: scope.userId,
                name: params.name,
                roleId: params.roleId
            }),
            (output) => output
        );
    }
};
