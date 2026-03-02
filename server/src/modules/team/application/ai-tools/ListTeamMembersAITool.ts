import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import ListTeamMembersByTeamIdUseCase from '@modules/team/application/use-cases/team-member/ListTeamMembersByTeamIdUseCase';

@injectable()
export class ListTeamMembersAITool extends AITool {
    readonly name = 'list_team_members';
    readonly description = 'List all members of the selected team with their roles.';
    readonly parameters = z.object({ page: z.number().optional().default(1), limit: z.number().optional().default(50) });

    constructor(
        @inject(ListTeamMembersByTeamIdUseCase)
        protected readonly useCase: ListTeamMembersByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId, page: params.page, limit: params.limit });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.total} members.`,
            data: result.value.data.map((m: any) => ({
                memberId: m._id ?? m.id, userId: typeof m.user === 'string' ? m.user : (m.user?._id ?? ''),
                firstName: m.user?.firstName ?? '', lastName: m.user?.lastName ?? '', email: m.user?.email ?? '',
                roleName: typeof m.role === 'string' ? m.role : (m.role?.name ?? ''), joinedAt: m.joinedAt ?? null
            }))
        };
    }
}
