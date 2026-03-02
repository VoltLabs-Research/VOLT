import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class DeleteSecretKeyAITool extends AITool {
    readonly name = 'delete_secret_key';
    readonly description = 'Permanently delete an API secret key.';
    readonly parameters = z.object({ secretKeyId: z.string(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor() {
        super();
    }
}
