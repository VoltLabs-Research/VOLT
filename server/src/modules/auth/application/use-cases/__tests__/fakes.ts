/**
 * Plain in-memory fakes used by UseCase unit tests.
 *
 * Goals:
 * - Zero external dependencies (no MinIO / Redis / Mongo / BullMQ).
 * - No mocking framework (no Sinon / Jest). Just plain classes.
 * - Only the methods actually exercised by the UseCases are implemented.
 *   Other interface members are filled with throwing stubs via a Proxy so
 *   unexpected calls fail loudly instead of silently returning undefined.
 *
 * Re-use these fakes when adding tests for new UseCases. If your UseCase
 * needs an additional method, add a real impl here so coverage is shared
 * across the auth module (and ideally promoted to shared/testing later).
 */

import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import type { IUserRepository, UserWithPassword } from '@modules/auth/domain/port/IUserRepository';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IAvatarService } from '@modules/auth/domain/port/IAvatarService';
import type AuthSessionService from '@modules/auth/infrastructure/services/AuthSessionService';
import type { CreateSessionInput } from '@modules/auth/infrastructure/services/AuthSessionService';
import User from '@modules/auth/domain/entities/User';
import type { UserProps } from '@modules/auth/domain/entities/User';
import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type Session from '@modules/session/domain/entities/Session';
import { SessionActivityType } from '@modules/session/domain/entities/Session';

/**
 * Wrap a partial implementation in a Proxy so any unimplemented member
 * throws a descriptive error instead of returning `undefined`.
 */
export const withUnimplementedGuard = <T extends object>(
    label: string,
    partial: Partial<T>
): T => {
    return new Proxy(partial, {
        get(target, prop, receiver) {
            if (prop in target) return Reflect.get(target, prop, receiver);
            return () => {
                throw new Error(
                    `[fake:${label}] method "${String(prop)}" was invoked but is not implemented in the fake. Add it to fakes.ts if the UseCase now depends on it.`
                );
            };
        }
    }) as T;
};

// ---------------------------------------------------------------------------
// Password hasher: plain-text "hash"/"compare" so tests are deterministic.
// ---------------------------------------------------------------------------

export class FakePasswordHasher implements IPasswordHasher {
    public hashCalls: string[] = [];
    public compareCalls: Array<{ password: string; hash: string }> = [];

    async hash(password: string): Promise<string> {
        this.hashCalls.push(password);
        return `hashed::${password}`;
    }

    async compare(password: string, hash: string): Promise<boolean> {
        this.compareCalls.push({ password, hash });
        return hash === `hashed::${password}`;
    }
}

// ---------------------------------------------------------------------------
// User repository: Map<string, User> keyed by _id, with a secondary index
// on normalized email.
// ---------------------------------------------------------------------------

export interface SeedUserInput {
    _id?: string;
    email: string;
    password?: string;
    firstName?: string;
    lastName?: string;
}

let fakeUserIdCounter = 0;
const nextFakeUserId = (): string => `user-${++fakeUserIdCounter}`;

export class FakeUserRepository {
    public users = new Map<string, User>();
    // store hashed password separately to model the "password not selected by default" behaviour
    public passwords = new Map<string, string>();
    public updateLastLoginCalls: string[] = [];
    public updateByIdCalls: Array<{ id: string; data: Partial<UserProps> }> = [];
    public createCalls: Array<Partial<UserProps>> = [];

    seed(input: SeedUserInput): User {
        const _id = input._id ?? nextFakeUserId();
        const now = new Date();
        const props: UserProps = {
            email: User.normalizeEmail(input.email),
            firstName: User.normalizeName(input.firstName ?? 'Test'),
            lastName: User.normalizeName(input.lastName ?? 'User'),
            teams: [],
            analyses: [],
            lastLoginAt: now,
            lastSeenAt: now,
            createdAt: now,
            updatedAt: now
        };
        const user = new User(_id, props);
        this.users.set(_id, user);
        if (input.password !== undefined) {
            this.passwords.set(_id, input.password);
        }
        return user;
    }

    private byEmail(email: string): User | undefined {
        const normalized = User.normalizeEmail(email);
        for (const user of this.users.values()) {
            if (user.props.email === normalized) return user;
        }
        return undefined;
    }

    asIUserRepository(): IUserRepository {
        const self = this;

        const partial: Partial<IUserRepository> = {
            async findByEmail(email: string) {
                return self.byEmail(email) ?? null;
            },
            async findByEmailWithPassword(email: string) {
                const user = self.byEmail(email);
                if (!user) return null;
                const password = self.passwords.get(user._id) ?? '';
                const withPwd = Object.assign(
                    Object.create(Object.getPrototypeOf(user)),
                    user,
                    { password }
                ) as UserWithPassword;
                return withPwd;
            },
            async emailExists(email: string) {
                return self.byEmail(email) !== undefined;
            },
            async updateLastLogin(userId: string) {
                self.updateLastLoginCalls.push(userId);
                const user = self.users.get(userId);
                if (user) user.props.lastLoginAt = new Date();
            },
            async create(data: Partial<UserProps>) {
                self.createCalls.push(data);
                const _id = nextFakeUserId();
                const now = new Date();
                const props: UserProps = {
                    email: data.email ?? '',
                    firstName: data.firstName ?? '',
                    lastName: data.lastName ?? '',
                    teams: data.teams ?? [],
                    analyses: data.analyses ?? [],
                    lastLoginAt: data.lastLoginAt ?? now,
                    lastSeenAt: data.lastSeenAt ?? now,
                    createdAt: data.createdAt ?? now,
                    updatedAt: data.updatedAt ?? now,
                    role: data.role,
                    avatar: data.avatar
                };
                const user = new User(_id, props);
                self.users.set(_id, user);
                if (data.password !== undefined) {
                    self.passwords.set(_id, data.password);
                }
                return user;
            },
            async updateById(id: string, data: Partial<UserProps>) {
                self.updateByIdCalls.push({ id, data });
                const user = self.users.get(id);
                if (!user) return null;
                Object.assign(user.props, data);
                return user;
            }
        };

        return withUnimplementedGuard<IUserRepository>('IUserRepository', partial);
    }
}

// ---------------------------------------------------------------------------
// Session repository: records failed logins and created sessions in memory.
// ---------------------------------------------------------------------------

export interface FakeFailedLogin {
    userId: string | null;
    userAgent: string;
    ip: string;
    reason: string;
}

let fakeSessionIdCounter = 0;

export class FakeSessionRepository {
    public failedLogins: FakeFailedLogin[] = [];
    public createdSessions: Array<Partial<Session['props']>> = [];

    asISessionRepository(): ISessionRepository {
        const self = this;
        const partial: Partial<ISessionRepository> = {
            async createFailedLogin(userId, userAgent, ip, reason) {
                self.failedLogins.push({ userId, userAgent, ip, reason });
                const fake: Session = {
                    _id: `session-${++fakeSessionIdCounter}`,
                    props: {
                        user: userId,
                        token: null,
                        userAgent,
                        ip,
                        isActive: false,
                        lastActivity: new Date(),
                        action: SessionActivityType.FailedLogin,
                        success: false,
                        failureReason: reason,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                };
                return fake;
            },
            async create(data) {
                self.createdSessions.push(data);
                const fake: Session = {
                    _id: `session-${++fakeSessionIdCounter}`,
                    props: {
                        user: (data.user as string | null) ?? null,
                        token: (data.token as string | null) ?? null,
                        userAgent: (data.userAgent as string) ?? '',
                        ip: (data.ip as string) ?? '',
                        isActive: data.isActive ?? true,
                        lastActivity: data.lastActivity ?? new Date(),
                        action: data.action ?? SessionActivityType.Login,
                        success: data.success ?? true,
                        createdAt: data.createdAt ?? new Date(),
                        updatedAt: data.updatedAt ?? new Date()
                    }
                };
                return fake;
            }
        };
        return withUnimplementedGuard<ISessionRepository>('ISessionRepository', partial);
    }
}

// ---------------------------------------------------------------------------
// AuthSessionService fake: returns a deterministic token without touching a
// real TokenService or SessionRepository.
// ---------------------------------------------------------------------------

export class FakeAuthSessionService {
    public calls: CreateSessionInput[] = [];
    public nextToken = 'fake-jwt-token';

    asAuthSessionService(): AuthSessionService {
        const self = this;
        const partial: Partial<AuthSessionService> = {
            async createSessionWithToken(input: CreateSessionInput) {
                self.calls.push(input);
                return self.nextToken;
            }
        };
        return withUnimplementedGuard<AuthSessionService>('AuthSessionService', partial);
    }
}

// ---------------------------------------------------------------------------
// Event bus fake: collects published events.
// ---------------------------------------------------------------------------

export class FakeEventBus {
    public published: IDomainEvent[] = [];

    asIEventBus(): IEventBus {
        const self = this;
        const partial: Partial<IEventBus> = {
            async publish(event: IDomainEvent) {
                self.published.push(event);
            },
            async subscribe() {
                /* no-op */
            }
        };
        return withUnimplementedGuard<IEventBus>('IEventBus', partial);
    }
}

// ---------------------------------------------------------------------------
// Avatar service fake: returns a stable URL without uploading anything.
// ---------------------------------------------------------------------------

export class FakeAvatarService {
    public calls: Array<{ id: string; seed: string }> = [];
    public nextUrl = 'https://fake-avatar/user.png';

    asIAvatarService(): IAvatarService {
        const self = this;
        const partial: Partial<IAvatarService> = {
            async generateAndUploadDefaultAvatar(id: string, seed: string) {
                self.calls.push({ id, seed });
                return self.nextUrl;
            }
        };
        return withUnimplementedGuard<IAvatarService>('IAvatarService', partial);
    }
}
