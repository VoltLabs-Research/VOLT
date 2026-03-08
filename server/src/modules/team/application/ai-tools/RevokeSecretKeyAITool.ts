import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import RevokeSecretKeyByIdUseCase from '@modules/team/application/use-cases/secret-key/RevokeSecretKeyByIdUseCase';
import { TeamUseCaseAITool } from './TeamUseCaseAITool';

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
    protected needsApproval = true;

    constructor(
        @inject(RevokeSecretKeyByIdUseCase)
        useCase: RevokeSecretKeyByIdUseCase
    ) {
        super(useCase, (params, scope) => ({
            teamId: scope.teamId,
            secretKeyId: params.secretKeyId
        }));
    }
}
