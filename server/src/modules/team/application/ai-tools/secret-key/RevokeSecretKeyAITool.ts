import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import RevokeSecretKeyByIdUseCase from '@modules/team/application/use-cases/secret-key/RevokeSecretKeyByIdUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

const revokeSecretKeyParametersSchema = z.object({
    secretKeyId: z.string(),
    reason: z.string().optional()
});

@injectable()
export class RevokeSecretKeyAITool extends TeamUseCaseAITool<
    z.infer<typeof revokeSecretKeyParametersSchema>,
    RevokeSecretKeyByIdUseCase,
    typeof revokeSecretKeyParametersSchema
> {
    readonly name = 'revoke_secret_key';
    readonly description = 'Revoke an API secret key.';
    readonly parameters = revokeSecretKeyParametersSchema;

    constructor(
        @inject(RevokeSecretKeyByIdUseCase)
        useCase: RevokeSecretKeyByIdUseCase
    ) {
        super(
            useCase,
            (params, scope) => ({
                teamId: scope.teamId,
                secretKeyId: params.secretKeyId
            }),
            (output) => output
        );
    }
};
