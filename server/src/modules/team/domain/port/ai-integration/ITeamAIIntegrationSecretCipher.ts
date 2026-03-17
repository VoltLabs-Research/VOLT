export interface ITeamAIIntegrationSecretCipher {
    encrypt(value: string): Promise<string>;
    decrypt(value: string): Promise<string>;
};
