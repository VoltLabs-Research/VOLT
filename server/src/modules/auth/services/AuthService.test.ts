import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import AuthService from '@modules/auth/services/AuthService';
import AvatarService from '@modules/auth/services/AvatarService';
import BcryptPasswordHasher from '@modules/auth/services/BcryptPasswordHasher';
import JwtTokenService from '@modules/auth/services/JwtTokenService';
import DefaultTeamEnroller from '@modules/team/services/team/DefaultTeamEnroller';
import User from '@modules/auth/models/User';
import Session from '@modules/session/models/Session';
import { OAuthProvider, UserRole } from '@modules/auth/contracts/domain/user';
import { SessionActivityType } from '@volt/contracts/modules/session/domain';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface AvatarUpload{
    kind: 'default' | 'custom';
    userId: string;
}

const PASSWORD = 'password-123';
const CONTEXT = {
    ip: '10.0.0.1',
    userAgent: 'volt-tests'
};

describe('AuthService', () => {
    let dataSource: DataSource;
    let passwordHash: string;
    const service = new AuthService();
    const hasher = new BcryptPasswordHasher();
    const tokenService = new JwtTokenService();
    const published: EmittedEvent[] = [];
    const avatarUploads: AvatarUpload[] = [];
    const enrollments: string[] = [];
    let enrollmentFailure: Error | null = null;
    const originalDeploymentMode = process.env.DEPLOYMENT_MODE;

    before(async () => {
        dataSource = await createHarness([User, Session]);
        passwordHash = await hasher.hash(PASSWORD);

        eventBus.emit = async (name, payload) => {
            published.push({
                name,
                payload
            });
        };
        AvatarService.prototype.generateAndUploadDefaultAvatar = (async (userId: string) => {
            avatarUploads.push({
                kind: 'default',
                userId
            });
            return `https://storage.volt.test/volt-avatars/${userId}_default.svg`;
        }) as typeof AvatarService.prototype.generateAndUploadDefaultAvatar;
        AvatarService.prototype.uploadCustomAvatar = (async (userId: string) => {
            avatarUploads.push({
                kind: 'custom',
                userId
            });
            return `https://storage.volt.test/volt-avatars/${userId}_custom.webp`;
        }) as typeof AvatarService.prototype.uploadCustomAvatar;
        DefaultTeamEnroller.prototype.enrollIfConfigured = (async (userId: string) => {
            enrollments.push(userId);
            if(enrollmentFailure) throw enrollmentFailure;
        }) as typeof DefaultTeamEnroller.prototype.enrollIfConfigured;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
        if(originalDeploymentMode === undefined){
            delete process.env.DEPLOYMENT_MODE;
            return;
        }
        process.env.DEPLOYMENT_MODE = originalDeploymentMode;
    });

    beforeEach(async () => {
        mock.timers.reset();
        await dataSource.synchronize(true);
        published.length = 0;
        avatarUploads.length = 0;
        enrollments.length = 0;
        enrollmentFailure = null;
        delete process.env.DEPLOYMENT_MODE;
    });

    const seedLocalUser = (overrides: Partial<User> = {}): Promise<User> => User.create({
        email: 'ada@volt.test',
        firstName: 'ada',
        lastName: 'lovelace',
        password: passwordHash,
        role: UserRole.User,
        teams: [],
        analyses: [],
        ...overrides
    }).save();

    const signUpAda = (): Promise<{ token: string; user: Record<string, unknown> }> => service.signUp({
        email: 'ada@volt.test',
        firstName: 'Ada',
        lastName: 'Lovelace',
        password: PASSWORD
    }, CONTEXT);

    const expectApplicationError = async (
        run: () => Promise<unknown>,
        code: string,
        statusCode: number,
        message: string
    ): Promise<void> => {
        await assert.rejects(run, (error: unknown) => {
            assert.ok(error instanceof ApplicationError);
            assert.equal(error.code, code);
            assert.equal(error.statusCode, statusCode);
            assert.equal(error.message, message);
            return true;
        });
    };

    describe('signUp', () => {
        it('stores the new account with a hashed password', async () => {
            await signUpAda();

            const stored = await User.findOneByOrFail({ email: 'ada@volt.test' });
            assert.notEqual(stored.password, PASSWORD);
            assert.equal(await hasher.compare(PASSWORD, stored.password ?? ''), true);
        });

        it('lower cases the email and both names', async () => {
            const { user } = await service.signUp({
                email: '  ADA@Volt.TEST ',
                firstName: ' Ada ',
                lastName: ' Lovelace ',
                password: PASSWORD
            }, CONTEXT);

            assert.equal(user.email, 'ada@volt.test');
            assert.equal(user.firstName, 'ada');
            assert.equal(user.lastName, 'lovelace');
        });

        it('never returns the password of the new account', async () => {
            const { user } = await signUpAda();

            assert.equal('password' in user, false);
        });

        it('keeps the password loaded on the entity even though the wire view hides it', async () => {
            await signUpAda();

            const stored = await User.findOneByOrFail({ email: 'ada@volt.test' });
            assert.equal(typeof stored.password, 'string');
            assert.equal('password' in stored.toJSON(), false);
        });

        it('answers with _id and drops id', async () => {
            const { user } = await signUpAda();

            assert.equal(typeof user._id, 'string');
            assert.equal('id' in user, false);
        });

        it('reports the columns without a value as null instead of omitting them', async () => {
            const { user } = await signUpAda();

            assert.equal(user.passwordChangedAt, null);
            assert.equal(user.oauthProvider, null);
            assert.equal(user.oauthId, null);
            assert.ok('passwordChangedAt' in user);
            assert.ok('oauthProvider' in user);
            assert.ok('oauthId' in user);
        });

        it('gives the new account the user role and empty collections', async () => {
            const { user } = await signUpAda();

            assert.equal(user.role, UserRole.User);
            assert.deepEqual(user.teams, []);
            assert.deepEqual(user.analyses, []);
        });

        it('answers with dates as date objects', async () => {
            const { user } = await signUpAda();

            assert.ok(user.createdAt instanceof Date);
            assert.ok(user.lastLoginAt instanceof Date);
        });

        it('attaches the generated default avatar to the new account', async () => {
            const { user } = await signUpAda();

            const stored = await User.findOneByOrFail({ email: 'ada@volt.test' });
            assert.deepEqual(avatarUploads, [{
                kind: 'default',
                userId: stored.id
            }]);
            assert.equal(user.avatar, `https://storage.volt.test/volt-avatars/${stored.id}_default.svg`);
            assert.equal(stored.avatar, user.avatar);
        });

        it('opens a login session for the new account', async () => {
            const { token } = await signUpAda();

            const stored = await User.findOneByOrFail({ email: 'ada@volt.test' });
            const session = await Session.findOneByOrFail({ token });
            assert.equal(session.user, stored.id);
            assert.equal(session.action, SessionActivityType.Login);
            assert.equal(session.isActive, true);
            assert.equal(tokenService.verify(token)?.id, stored.id);
        });

        it('publishes user.created with the new account', async () => {
            await signUpAda();

            const stored = await User.findOneByOrFail({ email: 'ada@volt.test' });
            assert.deepEqual(published, [{
                name: 'user.created',
                payload: {
                    id: stored.id,
                    firstName: 'ada'
                }
            }]);
        });

        it('enrolls the new account in the default team', async () => {
            await signUpAda();

            const stored = await User.findOneByOrFail({ email: 'ada@volt.test' });
            assert.deepEqual(enrollments, [stored.id]);
        });

        it('still signs the new account in when the default team enrollment fails', async () => {
            enrollmentFailure = new Error('team is gone');

            const { token, user } = await signUpAda();

            assert.equal(typeof token, 'string');
            assert.equal(user.email, 'ada@volt.test');
            assert.equal(await User.countBy({ email: 'ada@volt.test' }), 1);
        });

        it('rejects an email that is already registered', async () => {
            await seedLocalUser();

            await expectApplicationError(
                signUpAda,
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                409,
                'Email already registered'
            );
            assert.equal(await User.countBy({ email: 'ada@volt.test' }), 1);
        });

        it('rejects an email that is already registered in another case', async () => {
            await seedLocalUser();

            await expectApplicationError(
                () => service.signUp({
                    email: 'ADA@VOLT.TEST',
                    firstName: 'Ada',
                    lastName: 'Lovelace',
                    password: PASSWORD
                }, CONTEXT),
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                409,
                'Email already registered'
            );
        });

        it('lets the database reject a duplicate email that skips the service check', async () => {
            await seedLocalUser();

            await assert.rejects(() => User.create({
                email: 'ada@volt.test',
                firstName: 'second'
            }).save(), /UNIQUE constraint failed/);
            assert.equal(await User.countBy({ email: 'ada@volt.test' }), 1);
        });

        it('rejects a blank email', async () => {
            await expectApplicationError(
                () => service.signUp({
                    email: '   ',
                    firstName: 'Ada',
                    lastName: 'Lovelace',
                    password: PASSWORD
                }, CONTEXT),
                ErrorCodes.AUTH_EMAIL_REQUIRED,
                400,
                'Email is required'
            );
        });

        it('rejects a blank first name', async () => {
            await expectApplicationError(
                () => service.signUp({
                    email: 'ada@volt.test',
                    firstName: '  ',
                    lastName: 'Lovelace',
                    password: PASSWORD
                }, CONTEXT),
                ErrorCodes.AUTH_NAME_REQUIRED,
                400,
                'First and last name are required'
            );
        });

        it('rejects a missing last name', async () => {
            await expectApplicationError(
                () => service.signUp({
                    email: 'ada@volt.test',
                    firstName: 'Ada',
                    password: PASSWORD
                } as never, CONTEXT),
                ErrorCodes.AUTH_NAME_REQUIRED,
                400,
                'First and last name are required'
            );
        });

        it('accepts an empty last name', async () => {
            const { user } = await service.signUp({
                email: 'ada@volt.test',
                firstName: 'Ada',
                lastName: '',
                password: PASSWORD
            }, CONTEXT);

            assert.equal(user.lastName, '');
        });

        it('rejects a missing password', async () => {
            await expectApplicationError(
                () => service.signUp({
                    email: 'ada@volt.test',
                    firstName: 'Ada',
                    lastName: 'Lovelace'
                } as never, CONTEXT),
                ErrorCodes.AUTH_PASSWORD_REQUIRED,
                400,
                'Password is required'
            );
        });

        it('rejects a password shorter than eight characters', async () => {
            await expectApplicationError(
                () => service.signUp({
                    email: 'ada@volt.test',
                    firstName: 'Ada',
                    lastName: 'Lovelace',
                    password: 'short'
                }, CONTEXT),
                ErrorCodes.AUTH_PASSWORD_TOO_SHORT,
                400,
                'Password must be at least 8 characters'
            );
        });

        it('measures the password length in code points', async () => {
            const { user } = await service.signUp({
                email: 'ada@volt.test',
                firstName: 'Ada',
                lastName: 'Lovelace',
                password: '🔥🔥🔥🔥🔥🔥🔥🔥'
            }, CONTEXT);

            assert.equal(user.email, 'ada@volt.test');
        });

        it('rejects seven code points even though they span more utf16 units', async () => {
            await expectApplicationError(
                () => service.signUp({
                    email: 'ada@volt.test',
                    firstName: 'Ada',
                    lastName: 'Lovelace',
                    password: '🔥🔥🔥🔥🔥🔥🔥'
                }, CONTEXT),
                ErrorCodes.AUTH_PASSWORD_TOO_SHORT,
                400,
                'Password must be at least 8 characters'
            );
        });
    });

    describe('signIn', () => {
        it('returns a session token and the account for the right password', async () => {
            const user = await seedLocalUser();

            const result = await service.signIn({
                email: 'ada@volt.test',
                password: PASSWORD
            }, CONTEXT);

            assert.equal(result.user._id, user.id);
            assert.equal(tokenService.verify(result.token)?.id, user.id);
            assert.equal((await Session.findOneByOrFail({ token: result.token })).action, SessionActivityType.Login);
        });

        it('never returns the password of the account', async () => {
            await seedLocalUser();

            const result = await service.signIn({
                email: 'ada@volt.test',
                password: PASSWORD
            }, CONTEXT);

            assert.equal('password' in result.user, false);
        });

        it('matches the email regardless of case and padding', async () => {
            const user = await seedLocalUser();

            const result = await service.signIn({
                email: '  ADA@Volt.TEST ',
                password: PASSWORD
            }, CONTEXT);

            assert.equal(result.user._id, user.id);
        });

        it('refreshes lastLoginAt and lastSeenAt in the database', async () => {
            const user = await seedLocalUser();
            await User.update({ id: user.id }, {
                lastLoginAt: new Date('2020-01-01T00:00:00.000Z'),
                lastSeenAt: new Date('2020-01-01T00:00:00.000Z')
            });

            await service.signIn({
                email: 'ada@volt.test',
                password: PASSWORD
            }, CONTEXT);

            const stored = await User.findOneByOrFail({ id: user.id });
            assert.ok(stored.lastLoginAt.getTime() > new Date('2020-01-01T00:00:00.000Z').getTime());
            assert.ok(stored.lastSeenAt.getTime() > new Date('2020-01-01T00:00:00.000Z').getTime());
        });

        it('answers with the login timestamps as they were before the login', async () => {
            const user = await seedLocalUser();
            const previousLogin = new Date('2020-01-01T00:00:00.000Z');
            await User.update({ id: user.id }, {
                lastLoginAt: previousLogin,
                lastSeenAt: previousLogin
            });

            const result = await service.signIn({
                email: 'ada@volt.test',
                password: PASSWORD
            }, CONTEXT);

            assert.equal((result.user.lastLoginAt as Date).getTime(), previousLogin.getTime());
            assert.equal((result.user.lastSeenAt as Date).getTime(), previousLogin.getTime());
        });

        it('rejects an unknown email as invalid credentials', async () => {
            await expectApplicationError(
                () => service.signIn({
                    email: 'nobody@volt.test',
                    password: PASSWORD
                }, CONTEXT),
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                401,
                'Invalid email or password'
            );
        });

        it('records a failed login without an account when the email is unknown', async () => {
            await assert.rejects(() => service.signIn({
                email: 'nobody@volt.test',
                password: PASSWORD
            }, CONTEXT));

            const session = await Session.findOneByOrFail({ action: SessionActivityType.FailedLogin });
            assert.equal(session.user, null);
            assert.equal(session.token, null);
            assert.equal(session.isActive, false);
            assert.equal(session.success, false);
            assert.equal(session.ip, CONTEXT.ip);
            assert.equal(session.userAgent, CONTEXT.userAgent);
        });

        it('rejects a wrong password as invalid credentials', async () => {
            await seedLocalUser();

            await expectApplicationError(
                () => service.signIn({
                    email: 'ada@volt.test',
                    password: 'not-the-password'
                }, CONTEXT),
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                401,
                'Invalid email or password'
            );
        });

        it('records a failed login bound to the account when the password is wrong', async () => {
            const user = await seedLocalUser();

            await assert.rejects(() => service.signIn({
                email: 'ada@volt.test',
                password: 'not-the-password'
            }, CONTEXT));

            const session = await Session.findOneByOrFail({ action: SessionActivityType.FailedLogin });
            assert.equal(session.user, user.id);
            assert.equal(session.success, false);
        });

        it('records every failed login even though sessions hold a unique token', async () => {
            await seedLocalUser();
            const attempt = () => service.signIn({
                email: 'ada@volt.test',
                password: 'not-the-password'
            }, CONTEXT);

            await assert.rejects(attempt);
            await assert.rejects(attempt);

            assert.equal(await Session.countBy({ action: SessionActivityType.FailedLogin }), 2);
        });

        it('rejects an oauth only account that has no password', async () => {
            await seedLocalUser({
                password: null,
                oauthProvider: OAuthProvider.GitHub,
                oauthId: 'gh-1'
            });

            await expectApplicationError(
                () => service.signIn({
                    email: 'ada@volt.test',
                    password: PASSWORD
                }, CONTEXT),
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                401,
                'Invalid email or password'
            );
        });

        it('normalizes the collections of an account that never got any', async () => {
            await User.create({
                email: 'ada@volt.test',
                firstName: 'ada',
                password: passwordHash
            }).save();

            const result = await service.signIn({
                email: 'ada@volt.test',
                password: PASSWORD
            }, CONTEXT);

            assert.deepEqual(result.user.teams, []);
            assert.deepEqual(result.user.analyses, []);
        });

        it('returns the stored collections untouched', async () => {
            await seedLocalUser({
                teams: ['team-a', 'team-b'],
                analyses: ['analysis-a']
            });

            const result = await service.signIn({
                email: 'ada@volt.test',
                password: PASSWORD
            }, CONTEXT);

            assert.deepEqual(result.user.teams, ['team-a', 'team-b']);
            assert.deepEqual(result.user.analyses, ['analysis-a']);
        });
    });

    describe('localSignIn', () => {
        it('is not found when the deployment is not local', async () => {
            await expectApplicationError(
                () => service.localSignIn(CONTEXT),
                ErrorCodes.USER_NOT_FOUND,
                404,
                'Not found'
            );
        });

        it('is not found when the local account is not provisioned yet', async () => {
            process.env.DEPLOYMENT_MODE = 'local';

            await expectApplicationError(
                () => service.localSignIn(CONTEXT),
                ErrorCodes.USER_NOT_FOUND,
                404,
                'Local user is not provisioned yet'
            );
        });

        it('signs the local account in without a password', async () => {
            process.env.DEPLOYMENT_MODE = 'local';
            const local = await seedLocalUser({
                email: 'local@volt.local',
                password: null
            });

            const result = await service.localSignIn(CONTEXT);

            assert.equal(result.user._id, local.id);
            assert.equal('password' in result.user, false);
            assert.equal(tokenService.verify(result.token)?.id, local.id);
        });
    });

    describe('oauthLogin', () => {
        const oauthInput = {
            ...CONTEXT,
            email: 'ada@volt.test',
            oauthProvider: OAuthProvider.GitHub,
            oauthId: 'gh-1'
        };

        it('creates an account for an unknown oauth identity', async () => {
            const result = await service.oauthLogin({
                ...oauthInput,
                firstName: 'Ada',
                lastName: 'Lovelace'
            });

            const stored = await User.findOneByOrFail({ email: 'ada@volt.test' });
            assert.equal(result.user._id, stored.id);
            assert.equal(stored.oauthProvider, OAuthProvider.GitHub);
            assert.equal(stored.oauthId, 'gh-1');
            assert.equal(stored.password, null);
            assert.equal(stored.firstName, 'ada');
            assert.equal(stored.lastName, 'lovelace');
        });

        it('never returns the password of the oauth account', async () => {
            const result = await service.oauthLogin(oauthInput);

            assert.equal('password' in result.user, false);
        });

        it('derives a name from the oauth id when the provider sends none', async () => {
            const result = await service.oauthLogin(oauthInput);

            assert.equal(result.user.firstName, 'clever');
            assert.equal(result.user.lastName, 'raccoon');
        });

        it('starts the oauth account with empty collections', async () => {
            const result = await service.oauthLogin(oauthInput);

            assert.deepEqual(result.user.teams, []);
            assert.deepEqual(result.user.analyses, []);
        });

        it('publishes user.created for the new oauth account', async () => {
            await service.oauthLogin(oauthInput);

            const stored = await User.findOneByOrFail({ email: 'ada@volt.test' });
            assert.deepEqual(published, [{
                name: 'user.created',
                payload: {
                    id: stored.id,
                    firstName: stored.firstName
                }
            }]);
        });

        it('enrolls the new oauth account in the default team', async () => {
            await service.oauthLogin(oauthInput);

            const stored = await User.findOneByOrFail({ email: 'ada@volt.test' });
            assert.deepEqual(enrollments, [stored.id]);
        });

        it('records an oauth login session', async () => {
            const result = await service.oauthLogin(oauthInput);

            const session = await Session.findOneByOrFail({ token: result.token });
            assert.equal(session.action, SessionActivityType.OAuthLogin);
            assert.equal(session.isActive, true);
        });

        it('signs the returning oauth identity in without creating another account', async () => {
            mock.timers.enable({
                apis: ['Date'],
                now: 1_700_000_000_000
            });
            await service.oauthLogin(oauthInput);
            published.length = 0;
            mock.timers.setTime(1_700_000_002_000);

            const result = await service.oauthLogin(oauthInput);

            assert.equal(await User.count(), 1);
            assert.deepEqual(published, []);
            assert.equal(result.user.email, 'ada@volt.test');
        });

        it('rejects a second oauth login of the same identity inside the same second because the session token repeats', async () => {
            mock.timers.enable({
                apis: ['Date'],
                now: 1_700_000_000_000
            });
            await service.oauthLogin(oauthInput);

            await assert.rejects(() => service.oauthLogin(oauthInput), /UNIQUE constraint failed/);
            assert.equal(await User.count(), 1);
        });

        it('links the oauth identity to the account that already owns the email', async () => {
            const existing = await seedLocalUser();

            await service.oauthLogin(oauthInput);

            const stored = await User.findOneByOrFail({ id: existing.id });
            assert.equal(await User.count(), 1);
            assert.equal(stored.oauthProvider, OAuthProvider.GitHub);
            assert.equal(stored.oauthId, 'gh-1');
            assert.deepEqual(published, []);
        });

        it('answers with the account as it was before the oauth identity was linked', async () => {
            await seedLocalUser();

            const result = await service.oauthLogin(oauthInput);

            assert.equal(result.user.oauthProvider, null);
            assert.equal(result.user.oauthId, null);
        });

        it('matches the email of the existing account regardless of case', async () => {
            const existing = await seedLocalUser();

            await service.oauthLogin({
                ...oauthInput,
                email: 'ADA@Volt.TEST'
            });

            assert.equal(await User.count(), 1);
            assert.equal((await User.findOneByOrFail({ id: existing.id })).oauthId, 'gh-1');
        });

        it('keeps the avatar of the existing account when the provider sends none', async () => {
            const existing = await seedLocalUser({ avatar: 'https://storage.volt.test/volt-avatars/kept.svg' });

            await service.oauthLogin(oauthInput);

            const stored = await User.findOneByOrFail({ id: existing.id });
            assert.equal(stored.avatar, 'https://storage.volt.test/volt-avatars/kept.svg');
        });

        it('replaces the avatar of the existing account with the one from the provider', async () => {
            const existing = await seedLocalUser({ avatar: 'https://storage.volt.test/volt-avatars/kept.svg' });

            await service.oauthLogin({
                ...oauthInput,
                avatar: 'https://github.test/ada.png'
            });

            const stored = await User.findOneByOrFail({ id: existing.id });
            assert.equal(stored.avatar, 'https://github.test/ada.png');
        });

        it('does not generate a default avatar for an oauth account', async () => {
            await service.oauthLogin(oauthInput);

            assert.deepEqual(avatarUploads, []);
            assert.equal((await User.findOneByOrFail({ email: 'ada@volt.test' })).avatar, null);
        });

        it('refreshes lastLoginAt in the database but answers with the previous value', async () => {
            const existing = await seedLocalUser({
                oauthProvider: OAuthProvider.GitHub,
                oauthId: 'gh-1'
            });
            const previousLogin = new Date('2020-01-01T00:00:00.000Z');
            await User.update({ id: existing.id }, {
                lastLoginAt: previousLogin,
                lastSeenAt: previousLogin
            });

            const result = await service.oauthLogin(oauthInput);

            assert.equal((result.user.lastLoginAt as Date).getTime(), previousLogin.getTime());
            const stored = await User.findOneByOrFail({ id: existing.id });
            assert.ok(stored.lastLoginAt.getTime() > previousLogin.getTime());
        });

        it('lets the database reject two accounts sharing one oauth identity', async () => {
            await service.oauthLogin(oauthInput);

            await assert.rejects(() => User.create({
                email: 'second@volt.test',
                firstName: 'second',
                oauthProvider: OAuthProvider.GitHub,
                oauthId: 'gh-1'
            }).save(), /UNIQUE constraint failed/);
        });

        it('allows many accounts without any oauth identity', async () => {
            await seedLocalUser();
            await seedLocalUser({ email: 'grace@volt.test' });

            assert.equal(await User.count(), 2);
        });

        it('tells the same oauth id apart across providers', async () => {
            await service.oauthLogin(oauthInput);

            await service.oauthLogin({
                ...oauthInput,
                email: 'second@volt.test',
                oauthProvider: OAuthProvider.Google
            });

            assert.equal(await User.count(), 2);
        });
    });

    describe('getMyAccount', () => {
        it('returns the account together with its full name', async () => {
            const user = await seedLocalUser();

            const account = await service.getMyAccount(user.id);

            assert.equal(account._id, user.id);
            assert.equal(account.fullName, 'ada lovelace');
        });

        it('trims the full name of an account without a last name', async () => {
            const user = await seedLocalUser({ lastName: '' });

            assert.equal((await service.getMyAccount(user.id)).fullName, 'ada');
        });

        it('never returns the password', async () => {
            const user = await seedLocalUser();

            assert.equal('password' in await service.getMyAccount(user.id), false);
        });

        it('reports the columns without a value as null instead of omitting them', async () => {
            const user = await User.create({
                email: 'ada@volt.test',
                firstName: 'ada'
            }).save();

            const account = await service.getMyAccount(user.id);

            assert.equal(account.passwordChangedAt, null);
            assert.equal(account.oauthProvider, null);
            assert.equal(account.oauthId, null);
            assert.equal(account.avatar, null);
        });

        it('normalizes the null collections of the entity to arrays on the wire', async () => {
            const user = await User.create({
                email: 'ada@volt.test',
                firstName: 'ada'
            }).save();

            const stored = await User.findOneByOrFail({ id: user.id });
            assert.equal(stored.toJSON().teams, null);
            const account = await service.getMyAccount(user.id);
            assert.deepEqual(account.teams, []);
            assert.deepEqual(account.analyses, []);
        });

        it('rejects an unknown account', async () => {
            await expectApplicationError(
                () => service.getMyAccount('missing-user'),
                ErrorCodes.USER_NOT_FOUND,
                404,
                'User not found'
            );
        });
    });

    describe('getPasswordInfo', () => {
        it('reports that a local account has a password', async () => {
            const user = await seedLocalUser();

            const info = await service.getPasswordInfo(user.id);

            assert.equal(info.hasPassword, true);
            assert.equal(info.lastChanged, undefined);
        });

        it('reports that an oauth account has no password', async () => {
            const user = await seedLocalUser({ password: null });

            assert.equal((await service.getPasswordInfo(user.id)).hasPassword, false);
        });

        it('returns the last password change as an iso timestamp', async () => {
            const user = await seedLocalUser({ passwordChangedAt: new Date('2024-05-06T07:08:09.000Z') });

            assert.equal((await service.getPasswordInfo(user.id)).lastChanged, '2024-05-06T07:08:09.000Z');
        });

        it('rejects an unknown account', async () => {
            await expectApplicationError(
                () => service.getPasswordInfo('missing-user'),
                ErrorCodes.USER_NOT_FOUND,
                404,
                'User not found'
            );
        });
    });

    describe('checkEmail', () => {
        it('finds a registered email', async () => {
            await seedLocalUser();

            assert.deepEqual(await service.checkEmail('ada@volt.test'), { exists: true });
        });

        it('finds a registered email written in another case', async () => {
            await seedLocalUser();

            assert.deepEqual(await service.checkEmail(' ADA@Volt.TEST '), { exists: true });
        });

        it('reports an unknown email as free', async () => {
            await seedLocalUser();

            assert.deepEqual(await service.checkEmail('grace@volt.test'), { exists: false });
        });

        it('does not read an sql wildcard as a pattern', async () => {
            await seedLocalUser();

            assert.deepEqual(await service.checkEmail('%@volt.test'), { exists: false });
        });

        it('does not read an sql single character wildcard as a pattern', async () => {
            await seedLocalUser();

            assert.deepEqual(await service.checkEmail('_da@volt.test'), { exists: false });
        });
    });

    describe('updateAccount', () => {
        it('renames the account and lower cases both names', async () => {
            const user = await seedLocalUser();

            const account = await service.updateAccount(user.id, {
                firstName: ' Grace ',
                lastName: ' Hopper '
            });

            assert.equal(account.firstName, 'grace');
            assert.equal(account.lastName, 'hopper');
            assert.equal(account.fullName, 'grace hopper');
            const stored = await User.findOneByOrFail({ id: user.id });
            assert.equal(stored.firstName, 'grace');
            assert.equal(stored.lastName, 'hopper');
        });

        it('splits a full name into first and last name', async () => {
            const user = await seedLocalUser();

            const account = await service.updateAccount(user.id, { fullName: 'Grace Brewster Hopper' });

            assert.equal(account.firstName, 'grace');
            assert.equal(account.lastName, 'brewster hopper');
        });

        it('keeps the stored last name when the full name has a single word', async () => {
            const user = await seedLocalUser();

            const account = await service.updateAccount(user.id, { fullName: 'Grace' });

            assert.equal(account.firstName, 'grace');
            assert.equal(account.lastName, 'lovelace');
        });

        it('changes the email and lower cases it', async () => {
            const user = await seedLocalUser();

            const account = await service.updateAccount(user.id, { email: ' GRACE@Volt.TEST ' });

            assert.equal(account.email, 'grace@volt.test');
            assert.equal((await User.findOneByOrFail({ id: user.id })).email, 'grace@volt.test');
        });

        it('accepts the email the account already owns', async () => {
            const user = await seedLocalUser();

            const account = await service.updateAccount(user.id, { email: 'ada@volt.test' });

            assert.equal(account.email, 'ada@volt.test');
        });

        it('rejects an email that another account already owns', async () => {
            const user = await seedLocalUser();
            await seedLocalUser({ email: 'grace@volt.test' });

            await expectApplicationError(
                () => service.updateAccount(user.id, { email: 'grace@volt.test' }),
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                409,
                'Email already registered'
            );
            assert.equal((await User.findOneByOrFail({ id: user.id })).email, 'ada@volt.test');
        });

        it('ignores the fields that arrive empty', async () => {
            const user = await seedLocalUser();

            const account = await service.updateAccount(user.id, {
                firstName: '',
                lastName: '',
                email: ''
            });

            assert.equal(account.firstName, 'ada');
            assert.equal(account.lastName, 'lovelace');
            assert.equal(account.email, 'ada@volt.test');
        });

        it('uploads the attached avatar and stores its url', async () => {
            const user = await seedLocalUser();

            const account = await service.updateAccount(user.id, {}, { buffer: Buffer.from('avatar') } as Express.Multer.File);

            assert.deepEqual(avatarUploads, [{
                kind: 'custom',
                userId: user.id
            }]);
            assert.equal(account.avatar, `https://storage.volt.test/volt-avatars/${user.id}_custom.webp`);
            assert.equal((await User.findOneByOrFail({ id: user.id })).avatar, account.avatar);
        });

        it('ignores an attached file that carries no buffer', async () => {
            const user = await seedLocalUser();

            await service.updateAccount(user.id, {}, {} as Express.Multer.File);

            assert.deepEqual(avatarUploads, []);
        });

        it('never returns the password', async () => {
            const user = await seedLocalUser();

            assert.equal('password' in await service.updateAccount(user.id, { firstName: 'Grace' }), false);
        });

        it('answers with _id and drops id', async () => {
            const user = await seedLocalUser();

            const account = await service.updateAccount(user.id, { firstName: 'Grace' });

            assert.equal(account._id, user.id);
            assert.equal('id' in account, false);
        });

        it('rejects an unknown account', async () => {
            await expectApplicationError(
                () => service.updateAccount('missing-user', { firstName: 'Grace' }),
                ErrorCodes.RESOURCE_NOT_FOUND,
                404,
                'User not found'
            );
        });
    });

    describe('updatePassword', () => {
        const NEW_PASSWORD = 'brand-new-password';

        it('replaces the password when the current one matches', async () => {
            const user = await seedLocalUser();

            await service.updatePassword(user.id, {
                passwordCurrent: PASSWORD,
                password: NEW_PASSWORD
            }, CONTEXT);

            const stored = await User.findOneByOrFail({ id: user.id });
            assert.equal(await hasher.compare(NEW_PASSWORD, stored.password ?? ''), true);
            assert.equal(await hasher.compare(PASSWORD, stored.password ?? ''), false);
        });

        it('never returns the password', async () => {
            const user = await seedLocalUser();

            const result = await service.updatePassword(user.id, {
                passwordCurrent: PASSWORD,
                password: NEW_PASSWORD
            }, CONTEXT);

            assert.equal('password' in result.user, false);
        });

        it('stamps passwordChangedAt just before the change', async () => {
            const user = await seedLocalUser();
            const startedAt = Date.now();

            const result = await service.updatePassword(user.id, {
                passwordCurrent: PASSWORD,
                password: NEW_PASSWORD
            }, CONTEXT);

            const stored = await User.findOneByOrFail({ id: user.id });
            assert.ok(stored.passwordChangedAt);
            assert.ok(stored.passwordChangedAt.getTime() <= startedAt);
            assert.ok(result.user.passwordChangedAt instanceof Date);
        });

        it('invalidates the tokens issued before the change', async () => {
            const user = await seedLocalUser();
            const issuedAt = Math.floor(Date.now() / 1000) - 60;

            await service.updatePassword(user.id, {
                passwordCurrent: PASSWORD,
                password: NEW_PASSWORD
            }, CONTEXT);

            const stored = await User.findOneByOrFail({ id: user.id });
            assert.equal(stored.isPasswordChangedAfterTokenIssued(issuedAt), true);
            assert.equal(stored.isPasswordChangedAfterTokenIssued(Math.floor(Date.now() / 1000) + 60), false);
        });

        it('opens a password update session', async () => {
            const user = await seedLocalUser();

            const result = await service.updatePassword(user.id, {
                passwordCurrent: PASSWORD,
                password: NEW_PASSWORD
            }, CONTEXT);

            const session = await Session.findOneByOrFail({ token: result.token });
            assert.equal(session.action, SessionActivityType.PasswordUpdate);
            assert.equal(session.user, user.id);
        });

        it('answers with the refreshed account because it reads it again', async () => {
            const user = await seedLocalUser();
            const previousLogin = new Date('2020-01-01T00:00:00.000Z');
            await User.update({ id: user.id }, { lastLoginAt: previousLogin });

            const result = await service.updatePassword(user.id, {
                passwordCurrent: PASSWORD,
                password: NEW_PASSWORD
            }, CONTEXT);

            assert.ok((result.user.lastLoginAt as Date).getTime() > previousLogin.getTime());
        });

        it('requires the current password when the account has one', async () => {
            const user = await seedLocalUser();

            await expectApplicationError(
                () => service.updatePassword(user.id, { password: NEW_PASSWORD }, CONTEXT),
                ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                400,
                'Current password is required'
            );
        });

        it('rejects a wrong current password', async () => {
            const user = await seedLocalUser();

            await expectApplicationError(
                () => service.updatePassword(user.id, {
                    passwordCurrent: 'not-the-password',
                    password: NEW_PASSWORD
                }, CONTEXT),
                ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                400,
                'Current password is incorrect'
            );
            const stored = await User.findOneByOrFail({ id: user.id });
            assert.equal(await hasher.compare(PASSWORD, stored.password ?? ''), true);
        });

        it('sets the first password of an oauth account without asking for the current one', async () => {
            const user = await seedLocalUser({ password: null });

            await service.updatePassword(user.id, { password: NEW_PASSWORD }, CONTEXT);

            const stored = await User.findOneByOrFail({ id: user.id });
            assert.equal(await hasher.compare(NEW_PASSWORD, stored.password ?? ''), true);
        });

        it('rejects a short password before it even looks the account up', async () => {
            await expectApplicationError(
                () => service.updatePassword('missing-user', { password: 'short' }, CONTEXT),
                ErrorCodes.AUTH_PASSWORD_TOO_SHORT,
                400,
                'Password must be at least 8 characters'
            );
        });

        it('rejects an unknown account', async () => {
            await expectApplicationError(
                () => service.updatePassword('missing-user', { password: NEW_PASSWORD }, CONTEXT),
                ErrorCodes.USER_NOT_FOUND,
                404,
                'User not found'
            );
        });
    });

    describe('deleteAccount', () => {
        it('deletes the account and reports success', async () => {
            const user = await seedLocalUser();

            assert.deepEqual(await service.deleteAccount(user.id), { success: true });
            assert.equal(await User.countBy({ id: user.id }), 0);
        });

        it('publishes user.deleted', async () => {
            const user = await seedLocalUser();

            await service.deleteAccount(user.id);

            assert.deepEqual(published, [{
                name: 'user.deleted',
                payload: { userId: user.id }
            }]);
        });

        it('lets the database cascade the sessions of the deleted account', async () => {
            const user = await seedLocalUser();
            const other = await seedLocalUser({ email: 'grace@volt.test' });
            await Session.create({
                user: user.id,
                token: 'token-of-deleted',
                userAgent: 'volt-tests',
                ip: '10.0.0.1'
            }).save();
            await Session.create({
                user: other.id,
                token: 'token-of-survivor',
                userAgent: 'volt-tests',
                ip: '10.0.0.1'
            }).save();

            await service.deleteAccount(user.id);

            assert.equal(await Session.countBy({ user: user.id }), 0);
            assert.equal(await Session.countBy({ user: other.id }), 1);
        });

        it('rejects an unknown account', async () => {
            await expectApplicationError(
                () => service.deleteAccount('missing-user'),
                ErrorCodes.RESOURCE_NOT_FOUND,
                404,
                'User not found'
            );
            assert.deepEqual(published, []);
        });
    });

    describe('getGuestIdentity', () => {
        it('derives the same guest identity from the same seed', async () => {
            assert.deepEqual(service.getGuestIdentity('seed-1'), service.getGuestIdentity('seed-1'));
        });

        it('derives a different guest identity from another seed', async () => {
            assert.notEqual(service.getGuestIdentity('seed-1').lastName, service.getGuestIdentity('seed-2').lastName);
        });

        it('names every guest Guest and tags it with four hex characters', async () => {
            const guest = service.getGuestIdentity('seed-1');

            assert.equal(guest.firstName, 'Guest');
            assert.match(guest.lastName, /^[0-9A-F]{4}$/);
        });

        it('returns the avatar as an inline svg data url', async () => {
            assert.match(service.getGuestIdentity('seed-1').avatar, /^data:image\/svg\+xml;base64,/);
        });

        it('rejects an empty seed', async () => {
            assert.throws(() => service.getGuestIdentity(''), (error: unknown) => {
                assert.ok(error instanceof ApplicationError);
                assert.equal(error.code, ErrorCodes.AUTHENTICATION_GUEST_SEED_REQUIRED);
                assert.equal(error.statusCode, 400);
                assert.equal(error.message, 'A seed query parameter is required');
                return true;
            });
        });
    });

    describe('getOAuthProviders', () => {
        it('lists only the providers that are configured', async () => {
            const originalGithub = process.env.GITHUB_CLIENT_ID;
            const originalGoogle = process.env.GOOGLE_CLIENT_ID;
            const originalMicrosoft = process.env.MICROSOFT_CLIENT_ID;
            delete process.env.GOOGLE_CLIENT_ID;
            delete process.env.MICROSOFT_CLIENT_ID;
            process.env.GITHUB_CLIENT_ID = 'github-client';

            try{
                assert.deepEqual(service.getOAuthProviders(), { providers: [OAuthProvider.GitHub] });
            }finally{
                if(originalGithub === undefined) delete process.env.GITHUB_CLIENT_ID;
                else process.env.GITHUB_CLIENT_ID = originalGithub;
                if(originalGoogle !== undefined) process.env.GOOGLE_CLIENT_ID = originalGoogle;
                if(originalMicrosoft !== undefined) process.env.MICROSOFT_CLIENT_ID = originalMicrosoft;
            }
        });
    });
});
