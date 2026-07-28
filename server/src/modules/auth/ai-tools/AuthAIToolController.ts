import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import AuthService from '@modules/auth/services/AuthService';
import { updateProfileSchema, type UpdateProfileInput } from '@volt/contracts/modules/auth/ai-tools';

export default class AuthAIToolController extends AIToolController {
    #service = new AuthService();

    @AITool({
        name: 'update_profile',
        description: 'Update the current user\'s account profile: their display name and/or email address. Only the provided fields are changed.',
        parameters: updateProfileSchema,
        needsApproval: true
    })
    async updateProfile(input: UpdateProfileInput & AIToolScope) {
        const account = await this.#service.updateAccount(input.userId, input);
        return { summary: `Updated profile for ${account.fullName}.`, data: account };
    }
}
