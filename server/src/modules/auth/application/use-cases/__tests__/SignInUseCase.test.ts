import 'reflect-metadata';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import SignInUseCase from '@modules/auth/application/use-cases/SignInUseCase';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    FakeAuthSessionService,
    FakePasswordHasher,
    FakeSessionRepository,
    FakeUserRepository
} from './fakes';

describe('SignInUseCase', () => {
    let userRepo: FakeUserRepository;
    let sessionRepo: FakeSessionRepository;
    let hasher: FakePasswordHasher;
    let authSession: FakeAuthSessionService;
    let useCase: SignInUseCase;

    beforeEach(() => {
        userRepo = new FakeUserRepository();
        sessionRepo = new FakeSessionRepository();
        hasher = new FakePasswordHasher();
        authSession = new FakeAuthSessionService();

        useCase = new SignInUseCase(
            userRepo.asIUserRepository(),
            hasher,
            sessionRepo.asISessionRepository(),
            authSession.asAuthSessionService()
        );
    });

    it('returns token and user on happy path', async () => {
        userRepo.seed({
            _id: 'u-happy',
            email: 'ada@example.com',
            password: 'hashed::s3cret'
        });

        const result = await useCase.execute({
            email: 'ada@example.com',
            password: 's3cret',
            ip: '127.0.0.1',
            userAgent: 'node-test'
        });

        assert.equal(result.success, true);
        if (!result.success) return;
        assert.equal(result.value.token, 'fake-jwt-token');
        assert.equal(result.value.user._id, 'u-happy');
        assert.equal(result.value.user.email, 'ada@example.com');
        assert.deepEqual(userRepo.updateLastLoginCalls, ['u-happy']);
        assert.equal(authSession.calls.length, 1);
        assert.equal(authSession.calls[0].userId, 'u-happy');
        assert.equal(sessionRepo.failedLogins.length, 0);
    });

    it('fails with AUTH_CREDENTIALS_INVALID when the email is unknown', async () => {
        const result = await useCase.execute({
            email: 'ghost@example.com',
            password: 'whatever',
            ip: '10.0.0.1',
            userAgent: 'ua'
        });

        assert.equal(result.success, false);
        if (result.success) return;
        assert.equal(result.error.code, ErrorCodes.AUTH_CREDENTIALS_INVALID);
        assert.equal(result.error.statusCode, 401);
        assert.equal(userRepo.updateLastLoginCalls.length, 0);
        assert.equal(authSession.calls.length, 0);
    });

    it('records a failed-login session with userId=null when the email is unknown', async () => {
        await useCase.execute({
            email: 'ghost@example.com',
            password: 'whatever',
            ip: '10.0.0.1',
            userAgent: 'ua-1'
        });

        assert.equal(sessionRepo.failedLogins.length, 1);
        const entry = sessionRepo.failedLogins[0];
        assert.equal(entry.userId, null);
        assert.equal(entry.reason, 'User not found');
        assert.equal(entry.ip, '10.0.0.1');
        assert.equal(entry.userAgent, 'ua-1');
    });

    it('fails and records a failed login with the user id when the password is wrong', async () => {
        userRepo.seed({
            _id: 'u-bad-pw',
            email: 'bob@example.com',
            password: 'hashed::right-password'
        });

        const result = await useCase.execute({
            email: 'bob@example.com',
            password: 'wrong-password',
            ip: '192.168.1.2',
            userAgent: 'ua-2'
        });

        assert.equal(result.success, false);
        if (result.success) return;
        assert.equal(result.error.code, ErrorCodes.AUTH_CREDENTIALS_INVALID);
        assert.equal(result.error.statusCode, 401);
        assert.equal(sessionRepo.failedLogins.length, 1);
        assert.equal(sessionRepo.failedLogins[0].userId, 'u-bad-pw');
        assert.equal(sessionRepo.failedLogins[0].reason, 'Invalid password');
        assert.equal(userRepo.updateLastLoginCalls.length, 0);
        assert.equal(authSession.calls.length, 0);
    });

    it('normalizes email lookup via findByEmailWithPassword (case-insensitive seed)', async () => {
        userRepo.seed({
            _id: 'u-case',
            email: 'Case@Example.COM',
            password: 'hashed::abc'
        });

        const result = await useCase.execute({
            email: 'case@example.com',
            password: 'abc',
            ip: '127.0.0.1',
            userAgent: 'ua'
        });

        assert.equal(result.success, true);
        if (!result.success) return;
        assert.equal(result.value.user._id, 'u-case');
    });

    it('does not leak the password hash through the output DTO', async () => {
        userRepo.seed({
            _id: 'u-leak',
            email: 'leak@example.com',
            password: 'hashed::pw'
        });

        const result = await useCase.execute({
            email: 'leak@example.com',
            password: 'pw',
            ip: '127.0.0.1',
            userAgent: 'ua'
        });

        assert.equal(result.success, true);
        if (!result.success) return;
        // toPersistedUserDTO spreads user.props — since UserProps.password is optional and never
        // populated on the plain User seeded above, the DTO must not contain it.
        assert.equal(result.value.user.password, undefined);
    });
});
