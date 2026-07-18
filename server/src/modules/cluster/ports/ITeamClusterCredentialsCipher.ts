export interface ITeamClusterCredentialsCipher {
    encrypt(value: string): Promise<string>;
    decrypt(value: string): Promise<string>;
}
