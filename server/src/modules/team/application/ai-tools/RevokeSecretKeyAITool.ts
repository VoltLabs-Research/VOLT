import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class RevokeSecretKeyAITool extends AITool {
    readonly name = 'revoke_secret_key';
    readonly description = 'Revoke an API secret key.';
    readonly parameters = z.object({ secretKeyId: z.string(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor() {
        super();
    }
}
