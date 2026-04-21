import { AITool } from '@shared/application/ai/AITool';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { TeamInvitationStatus } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ITeamInvitationRepository } from '@modules/team/domain/port/team-invitation/ITeamInvitationRepository';
import type { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';

interface ListPendingInvitationsResult {
    summary: string;
    data: PersistedOutput<TeamInvitationProps>[];
};

const listPendingInvitationsParametersSchema = z.object({});

@injectable()
export class ListPendingInvitationsAITool extends AITool<
    z.infer<typeof listPendingInvitationsParametersSchema>,
    ListPendingInvitationsResult,
    typeof listPendingInvitationsParametersSchema
> {
    readonly name = 'list_pending_invitations';
    readonly description = 'List pending team invitations.';
    readonly parameters = listPendingInvitationsParametersSchema;

    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        protected readonly repository: ITeamInvitationRepository
    ) {
        super();
    }

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope): Promise<ListPendingInvitationsResult> {
        const result = await this.repository.findAll({
            filter: {
                team: scope.teamId,
                status: TeamInvitationStatus.Pending
            },
            populate: { path: 'invitedUser' },
            page: 1,
            limit: 100
        });

        return {
            summary: `Found ${result.data.length} pending invitations.`,
            data: result.data.map((entity) => toPersistedOutput(entity))
        };
    }
};
