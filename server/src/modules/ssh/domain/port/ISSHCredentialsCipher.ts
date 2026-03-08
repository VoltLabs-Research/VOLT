export interface ISSHCredentialsCipher {
    encrypt(value: string): string;
    decrypt(value: string): string;
}
