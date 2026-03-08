interface SSHTokens {
    readonly SSHConnectionRepository: symbol;
    readonly SSHConnectionService: symbol;
    readonly SSHImportQueue: symbol;
    readonly SSHCredentialsCipher: symbol;
}

export const SSH_TOKENS: SSHTokens = {
    SSHConnectionRepository: Symbol.for('SSHConnectionRepository'),
    SSHConnectionService: Symbol.for('SSHConnectionService'),
    SSHImportQueue: Symbol.for('SSHImportQueue'),
    SSHCredentialsCipher: Symbol.for('SSHCredentialsCipher')
};
