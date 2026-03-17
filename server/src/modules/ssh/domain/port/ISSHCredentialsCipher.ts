export interface ISSHCredentialsCipher {
    encrypt(value: string): Promise<string>;
    decrypt(value: string): Promise<string>;
}
