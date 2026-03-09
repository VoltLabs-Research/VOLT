import User from '@modules/auth/domain/entities/User';
import type { UserProps } from '@modules/auth/domain/entities/User';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface UserWithPassword extends User {
    password: string;
};

export interface IUserRepository extends IBaseRepository<User, UserProps>{
    /**
     * Find user by ID with password included.
     */
    findByIdWithPassword(
        userId: string
    ): Promise<UserWithPassword | null>;

    /**
     * Add a team to the user's teams array (idempotent).
     */
    addTeamToUser(
        userId: string,
        teamId: string
    ): Promise<void>;

    /**
     * Delete the specified team from the user.
     */
    removeTeamFromUser(
        userId: string,
        teamId: string
    ): Promise<void>;

    /**
     * Delete the specified team from all users.
     */
    removeUsersFromTeam(teamId: string): Promise<void>;

    /**
     * Find user by email.
     */
    findByEmail(email: string): Promise<User | null>;

    /**
     * Find user by email with password included.
     */
    findByEmailWithPassword(
        email: string
    ): Promise<UserWithPassword | null>;

    /**
     * Check if email exists.
     */
    emailExists(email: string): Promise<boolean>;

    /**
     * Update user password.
     */
    updatePassword(
        userId: string,
        hashedPassword: string
    ): Promise<void>;

    /**
     * Update last login timestamp.
     */
    updateLastLogin(userId: string): Promise<void>;

    /**
     * Update last seen timestamp.
     */
    updateLastSeen(userId: string, timestamp?: Date): Promise<void>;

    /**
     * Update user avatar.
     */
    updateAvatar(userId: string, avatarUrl: string): Promise<void>;
};
