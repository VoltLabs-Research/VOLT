export interface ITeamAIIntegrationSecretCipher {
    encrypt(value: string): string;
    decrypt(value: string): string;
};
