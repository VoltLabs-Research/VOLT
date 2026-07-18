import { CHAT_CONTRACT_TOKENS } from '@shared/contracts/tokens/ChatTokens';
import { deleteManyOnTeamDeleted } from '@shared/application/events/cascadeDeleteHandlerFactories';

// The cascade resolves the model-backed ChatSearchRepository adapter registered
// under the neutral Symbol.for('ChatRepository') token — it exposes deleteMany.
deleteManyOnTeamDeleted(CHAT_CONTRACT_TOKENS.ChatRepository);
