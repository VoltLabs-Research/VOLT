import User from '@modules/auth/domain/entities/User';
import type { UserProps } from '@modules/auth/domain/entities/User';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface UserWithPassword extends User {
    password: string;
}

export interface IUserRepository extends IBaseRepository<User, UserProps>{
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

    removeTeamFromUser(
        userId: string,
        teamId: string
    ): Promise<void>;

    /**
     * Delete the specified team from all users.
     */
    removeUsersFromTeam(teamId: string): Promise<void>;

    findByEmail(email: string): Promise<User | null>;

    findByEmailWithPassword(
        email: string
    ): Promise<UserWithPassword | null>;

    emailExists(email: string): Promise<boolean>;

    updatePassword(
        userId: string,
        hashedPassword: string
    ): Promise<void>;

    updateLastLogin(userId: string): Promise<void>;
}
