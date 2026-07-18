import { switchSelectedTeam, useTeamStore } from '@/modules/team/stores/team/use-team-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface SwitchTeamInput {
    teamId?: string;
}

const switchTeam: ClientToolHandler<SwitchTeamInput> = {
    name: 'switch_team',

    run(input, ctx): ClientToolResult {
        const teamId = typeof input.teamId === 'string' ? input.teamId.trim() : '';

        if (!teamId) {
            return {
                ok: false,
                summary: 'Could not switch teams.',
                reason: 'missing_team_id',
                hint: 'A teamId is required. Resolve one with global_search / list_* first.'
            };
        }

        const previousTeamId = useTeamStore.getState().selectedTeamId;

        if (previousTeamId === teamId) {
            ctx.navigate('/dashboard');
            return {
                ok: true,
                summary: 'Already on that team. Returned to the dashboard.',
                data: { teamId, switched: false }
            };
        }

        switchSelectedTeam(teamId);
        ctx.navigate('/dashboard');

        return {
            ok: true,
            summary: 'Switched the active team and opened the dashboard.',
            data: { teamId, previousTeamId: previousTeamId ?? undefined, switched: true }
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return { label: 'Could not switch team', icon: 'team' };
        }
        const switched = (result.data as { switched?: boolean } | undefined)?.switched;
        return { label: switched ? 'Switched active team' : 'Already on team', icon: 'team' };
    }
};

export default switchTeam;
