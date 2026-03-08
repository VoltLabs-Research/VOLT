import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import GetPendingInvitationsUseCase from '@modules/team/application/use-cases/team-invitation/GetPendingInvitationsUseCase';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import type { TeamAIToolListResult } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import type { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';

const listPendingInvitationsParametersSchema = z.object({});

@injectable()
export class ListPendingInvitationsAITool extends TeamUseCaseAITool<
    z.infer<typeof listPendingInvitationsParametersSchema>,
    GetPendingInvitationsUseCase,
    typeof listPendingInvitationsParametersSchema,
    TeamAIToolListResult<TeamInvitationProps[]>
> {
    readonly name = 'list_pending_invitations';
    readonly description = 'List pending team invitations.';
    readonly parameters = listPendingInvitationsParametersSchema;

    constructor(
        @inject(GetPendingInvitationsUseCase)
        useCase: GetPendingInvitationsUseCase
    ) {
        super(
            useCase,
            (_, scope) => ({
                teamId: scope.teamId,
                page: 1,
                limit: 100
            }),
            (output) => ({
                summary: `Found ${output.data.length} pending invitations.`,
                data: output.data
            })
        );
    }
};
