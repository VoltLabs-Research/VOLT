import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetActiveSessionsUseCase from '@modules/session/application/use-cases/GetActiveSessionsUseCase';
import RevokeSessionUseCase from '@modules/session/application/use-cases/RevokeSessionUseCase';
import RevokeAllSessionsUseCase from '@modules/session/application/use-cases/RevokeAllSessionsUseCase';
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

    constructor(
        protected readonly getActiveSessionsUseCase: GetActiveSessionsUseCase,
        protected readonly revokeSessionUseCase: RevokeSessionUseCase,
        protected readonly revokeAllSessionsUseCase: RevokeAllSessionsUseCase
    ) {
        super();
    }

    async execute(params: ManageSessionsParams, scope: AIToolScope) {
        switch (params.action) {
            case 'list': {
                const result = await this.getActiveSessionsUseCase.execute({ userId: scope.userId });
                if (!result.success) throw result.error;
                return { summary: `Found ${result.value.length} active session(s).`, data: result.value };
            }
            case 'revoke': {
                if (!params.sessionId) throw new Error('sessionId is required to revoke a session.');
                const result = await this.revokeSessionUseCase.execute({
                    sessionId: params.sessionId,
                    userId: scope.userId
                });
                if (!result.success) throw result.error;
                return { summary: `Revoked session ${params.sessionId}.`, data: { sessionId: params.sessionId } };
            }
            case 'revoke_others': {
                const result = await this.revokeAllSessionsUseCase.execute({
                    userId: scope.userId,
                    token: ''
                });
                if (!result.success) throw result.error;
                return { summary: `Revoked ${result.value.revokedCount} other active session(s).`, data: result.value };
            }
        }
    }
}
