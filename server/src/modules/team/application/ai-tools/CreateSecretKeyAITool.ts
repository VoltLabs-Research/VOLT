import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class CreateSecretKeyAITool extends AITool {
    readonly name = 'create_secret_key';
    readonly description = 'Create a new API secret key.';
    readonly parameters = z.object({ name: z.string(), roleId: z.string(), reason: z.string().optional() });

    constructor() {
        super();
    }
}
