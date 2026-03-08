interface SessionTokens {
    readonly SessionRepository: symbol;
}

export const SESSION_TOKENS: SessionTokens = {
    SessionRepository: Symbol.for('SessionRepository')
};
