import { container } from 'tsyringe';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import SSHConnectionService from '@modules/ssh/infrastructure/services/SSHConnectionService';
import SSHCredentialsCipher from '@modules/ssh/infrastructure/services/SSHCredentialsCipher';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as sshAiTools from '@modules/ssh/application/ai-tools';
import type { ClassProvider } from 'tsyringe';

const SSH_AI_TOOL_CLASSES: ClassProvider<unknown>[] = Object.values(sshAiTools).map((useClass) => ({ useClass }));

export const registerSSHDependencies = () => {
    container.registerSingleton(SSH_TOKENS.SSHConnectionRepository, SSHConnectionRepository);
    container.registerSingleton(SSH_TOKENS.SSHConnectionService, SSHConnectionService);
    container.registerSingleton(SSH_TOKENS.SSHCredentialsCipher, SSHCredentialsCipher);

    // AI Tools
    for (const toolClassProvider of SSH_AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, toolClassProvider);
    }
};
