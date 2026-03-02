import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import GetPendingInvitationsUseCase from '@modules/team/application/use-cases/team-invitation/GetPendingInvitationsUseCase';

@injectable()
export class ListPendingInvitationsAITool extends AITool {
    readonly name = 'list_pending_invitations';
    readonly description = 'List pending team invitations.';
    readonly parameters = z.object({});

    constructor(
        @inject(GetPendingInvitationsUseCase)
        protected readonly useCase: GetPendingInvitationsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId, page: 1, limit: 100 });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.data.length} pending invitations.`, data: result.value.data };
    }
}
