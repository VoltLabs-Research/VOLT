import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import DeleteSecretKeyByIdUseCase from '@modules/team/application/use-cases/secret-key/DeleteSecretKeyByIdUseCase';
import { TeamUseCaseAITool } from './TeamUseCaseAITool';

const deleteSecretKeyParametersSchema = z.object({
    secretKeyId: z.string(),
    reason: z.string().optional()
});

@injectable()
export class DeleteSecretKeyAITool extends TeamUseCaseAITool<
    z.infer<typeof deleteSecretKeyParametersSchema>,
    DeleteSecretKeyByIdUseCase,
    typeof deleteSecretKeyParametersSchema
> {
    readonly name = 'delete_secret_key';
    readonly description = 'Permanently delete an API secret key.';
    readonly parameters = deleteSecretKeyParametersSchema;
    protected needsApproval = true;

    constructor(
        @inject(DeleteSecretKeyByIdUseCase)
        useCase: DeleteSecretKeyByIdUseCase
    ) {
        super(useCase, (params, scope) => ({
            teamId: scope.teamId,
            secretKeyId: params.secretKeyId
        }));
    }
}
