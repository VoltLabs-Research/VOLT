import { IBaseRepository } from '../../../../shared/domain/IBaseRepository';
import User, { UserProps } from '../entities/User';

export interface IUserRepository extends IBaseRepository<User, UserProps>{
    /**
     * Find user by ID with password included.
     */
    findByIdWithPassword(
        id: string
    ): Promise<(User & { password: string }) | null>;

    /**
     * Find user by email.
     */
    findByEmail(email: string): Promise<User | null>;

    /**
     * Find user by email with password included.
     */
    findByEmailWithPassword(
        email: string
    ): Promise<(User & { password: string }) | null>;

    /**
     * Check if email exists.
     */
    emailExists(email: string): Promise<boolean>;

    /**
     * Update user password.
     */
    updatePassword(
        id: string,
        hashedPassword: string
    ): Promise<void>;

    /**
     * Update last login timestamp.
     */
    updateLastLogin(id: string): Promise<void>;

    /**
     * Update user avatar.
     */
    updateAvatar(id: string, avatarUrl: string): Promise<void>;
};