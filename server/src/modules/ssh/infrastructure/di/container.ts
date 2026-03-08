import { container } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import SSHConnectionService from '@modules/ssh/services/SSHConnectionService';
import SSHImportQueue from '@modules/ssh/queues/SSHImportQueue';
import SSHCredentialsCipher from '@modules/ssh/services/SSHCredentialsCipher';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as sshAiTools from '@modules/ssh/application/ai-tools';

export const registerSSHDependencies = () => {
    container.registerSingleton(SSH_TOKENS.SSHConnectionRepository, SSHConnectionRepository);
    container.registerSingleton(SSH_TOKENS.SSHConnectionService, SSHConnectionService);
    container.registerSingleton(SSH_TOKENS.SSHImportQueue, SSHImportQueue);
    container.registerSingleton(SSH_TOKENS.SSHCredentialsCipher, SSHCredentialsCipher);

    // AI Tools
    for (const ToolClass of Object.values(sshAiTools)) {
        container.registerSingleton(AI_TOKENS.AITool, ToolClass as any);
    }
};
