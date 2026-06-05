import type { SessionActivityType } from '@modules/session/domain/entities/Session';

export interface CreateSessionInput {
    userId: string;
    ip: string;
    userAgent: string;
    activityType: SessionActivityType;
}

export interface IAuthSessionService {
    createSessionWithToken(input: CreateSessionInput): Promise<string>;
}
