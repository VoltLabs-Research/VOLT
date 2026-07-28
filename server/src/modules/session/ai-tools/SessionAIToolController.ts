import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import SessionService from '@modules/session/services/SessionService';
import type { ManageSessionsInput } from '@volt/contracts/modules/session/ai-tools';

export default class SessionAIToolController extends AIToolController {
    #service = new SessionService();

    @AITool({
        name: 'manage_sessions',
        description: 'Manage the current user\'s active login sessions: list active sessions, revoke a specific session by id, or revoke all other active sessions. Use action to pick the operation; sessionId is required for action "revoke".',
        parameters: typia.llm.parameters<ManageSessionsInput>(),
        validate: typia.createValidate<ManageSessionsInput>(),
        needsApproval: (input) => input.action === 'revoke' || input.action === 'revoke_others'
    })
    async manageSessions(input: ManageSessionsInput & AIToolScope) {
        switch (input.action) {
            case 'list': {
                const value = await this.#service.getActiveSessions(input.userId);
                return { summary: `Found ${value.length} active session(s).`, data: value };
            }
            case 'revoke': {
                if (!input.sessionId) throw new Error('sessionId is required to revoke a session.');
                await this.#service.revokeSession(input.sessionId, input.userId);
                return { summary: `Revoked session ${input.sessionId}.`, data: { sessionId: input.sessionId } };
            }
            case 'revoke_others': {
                const { revokedCount } = await this.#service.revokeAllSessions(input.userId, '');
                return { summary: `Revoked ${revokedCount} other active session(s).`, data: { revokedCount } };
            }
        }
    }
}
