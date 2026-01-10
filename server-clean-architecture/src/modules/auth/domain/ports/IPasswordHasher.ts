export interface IPasswordHasher{
    /**
     * Hash a plaain text password.
     */
    hash(password: string): Promise<string>;

    /**
     * Compare plain text password with hash.
     */
    compare(password: string, hash: string): Promise<boolean>;
};