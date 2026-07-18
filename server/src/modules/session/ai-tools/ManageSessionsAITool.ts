import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import SessionService from '@modules/session/services/SessionService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    action: z.enum(['list', 'revoke', 'revoke_others']),
    sessionId: z.string().optional()
});

type ManageSessionsParams = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ManageSessionsAITool extends AITool<ManageSessionsParams> {
    readonly name = 'manage_sessions';
    readonly description = 'Manage the current user\'s active login sessions: list active sessions, revoke a specific session by id, or revoke all other active sessions. Use action to pick the operation; sessionId is required for action "revoke".';
    readonly parameters = parameters;
    protected readonly needsApproval = (input: ManageSessionsParams) => input.action === 'revoke' || input.action === 'revoke_others';

    #service = new SessionService();

    async execute(params: ManageSessionsParams, scope: AIToolScope) {
        switch (params.action) {
            case 'list': {
                const value = await this.#service.getActiveSessions(scope.userId);
                return { summary: `Found ${value.length} active session(s).`, data: value };
            }
            case 'revoke': {
                if (!params.sessionId) throw new Error('sessionId is required to revoke a session.');
                await this.#service.revokeSession(params.sessionId, scope.userId);
                return { summary: `Revoked session ${params.sessionId}.`, data: { sessionId: params.sessionId } };
            }
            case 'revoke_others': {
                const value = await this.#service.revokeAllSessions(scope.userId, '');
                return { summary: `Revoked ${value.revokedCount} other active session(s).`, data: value };
            }
        }
    }
}
