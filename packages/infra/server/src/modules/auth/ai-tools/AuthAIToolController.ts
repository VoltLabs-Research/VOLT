import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool, AIToolAccess } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import authService from '@modules/auth/services/AuthService';
import type { UpdateProfileInput } from '@volt/contracts/modules/auth/ai-tools';

export default class AuthAIToolController extends AIToolController {
    @AITool({
        name: 'update_profile',
        description: 'Update the current user\'s account profile: their display name and/or email address. Only the provided fields are changed.',
        parameters: typia.llm.parameters<UpdateProfileInput>(),
        validate: typia.createValidate<UpdateProfileInput>(),
        access: AIToolAccess.Write,
        permission: null
    })
    async updateProfile(input: UpdateProfileInput & AIToolScope) {
        const account = await authService.updateAccount(input.userId, input);
        return {
            summary: `Updated profile for ${account.fullName}.`,
            data: account
        };
    }
}
