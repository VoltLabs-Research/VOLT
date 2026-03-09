export interface ITeamClusterCredentialsCipher {
    encrypt(value: string): string;
    decrypt(value: string): string;
};
