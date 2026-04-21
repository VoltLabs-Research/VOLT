import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import SSHConnectionService from '@modules/ssh/infrastructure/services/SSHConnectionService';
import SSHCredentialsCipher from '@modules/ssh/infrastructure/services/SSHCredentialsCipher';
import { SSHConnectionOwnershipService } from '@modules/ssh/application/services/SSHConnectionOwnershipService';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as sshAiTools from '@modules/ssh/application/ai-tools';
import { createClassBindings } from '@shared/infrastructure/di/ModuleManifest';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const sshDIManifest: ModuleManifest = {
    name: 'ssh',
    singletons: [
        SSHConnectionOwnershipService,
        [SSH_TOKENS.SSHConnectionRepository, SSHConnectionRepository],
        [SSH_TOKENS.SSHConnectionService, SSHConnectionService],
        [SSH_TOKENS.SSHCredentialsCipher, SSHCredentialsCipher]
    ],
    bindings: [
        ...createClassBindings(AI_TOKENS.AITool, sshAiTools)
    ]
};
