import { TeamUseCaseAITool } from '@modules/team/application/ai-tools/team/TeamUseCaseAITool';
import ListTeamMembersByTeamIdUseCase from '@modules/team/application/use-cases/team-member/ListTeamMembersByTeamIdUseCase';
import { isPopulatedTeamMemberUser, isPopulatedTeamMemberRole, getTeamMemberUserId } from '@modules/team/domain/entities/team-member/TeamMember';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import type { TeamMemberStatsProps } from '@modules/team/application/dtos/team-member/ListTeamMembersByTeamIdDTO';

interface TeamMemberListItem {
    memberId: string;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    roleName: string;
    joinedAt: Date | null;
};

interface TeamMemberListResult {
    summary: string;
    data: TeamMemberListItem[];
};

const listTeamMembersParametersSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50)
});

@injectable()
export class ListTeamMembersAITool extends TeamUseCaseAITool<
    z.infer<typeof listTeamMembersParametersSchema>,
    ListTeamMembersByTeamIdUseCase,
    typeof listTeamMembersParametersSchema,
    TeamMemberListResult
> {
    readonly name = 'list_team_members';
    readonly description = 'List all members of the selected team with their roles.';
    readonly parameters = listTeamMembersParametersSchema;

    constructor(
        @inject(ListTeamMembersByTeamIdUseCase)
        useCase: ListTeamMembersByTeamIdUseCase
    ) {
        super(
            useCase,
            (params, scope) => ({
                teamId: scope.teamId,
                page: params.page,
                limit: params.limit
            }),
            (output) => ({
                summary: `Found ${output.total} members.`,
                data: output.data.map((member: TeamMemberStatsProps) => {
                    const user = isPopulatedTeamMemberUser(member.user)
                        ? member.user
                        : undefined;
                    const role = isPopulatedTeamMemberRole(member.role)
                        ? member.role
                        : undefined;
                    const memberId = user?._id ?? getTeamMemberUserId(member.user);

                    return {
                        memberId,
                        userId: getTeamMemberUserId(member.user),
                        firstName: user?.firstName ?? '',
                        lastName: user?.lastName ?? '',
                        email: user?.email ?? '',
                        roleName: role?.name ?? '',
                        joinedAt: member.joinedAt ?? null
                    };
                })
            })
        );
    }
};
