interface SSHTokens {
    readonly SSHConnectionRepository: symbol;
    readonly SSHConnectionService: symbol;
    readonly SSHCredentialsCipher: symbol;
}

export const SSH_TOKENS: SSHTokens = {
    SSHConnectionRepository: Symbol.for('SSHConnectionRepository'),
    SSHConnectionService: Symbol.for('SSHConnectionService'),
    SSHCredentialsCipher: Symbol.for('SSHCredentialsCipher')
};
