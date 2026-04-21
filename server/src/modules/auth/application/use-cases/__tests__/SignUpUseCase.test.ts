import 'reflect-metadata';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import SignUpUseCase from '@modules/auth/application/use-cases/SignUpUseCase';
import UserCreatedEvent from '@modules/auth/domain/events/UserCreatedEvent';
import { UserRole } from '@modules/auth/domain/entities/User';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    FakeAuthSessionService,
    FakeAvatarService,
    FakeEventBus,
    FakePasswordHasher,
    FakeUserRepository
} from './fakes';

describe('SignUpUseCase', () => {
    let userRepo: FakeUserRepository;
    let hasher: FakePasswordHasher;
    let authSession: FakeAuthSessionService;
    let eventBus: FakeEventBus;
    let avatar: FakeAvatarService;
    let useCase: SignUpUseCase;

    beforeEach(() => {
        userRepo = new FakeUserRepository();
        hasher = new FakePasswordHasher();
        authSession = new FakeAuthSessionService();
        eventBus = new FakeEventBus();
        avatar = new FakeAvatarService();

        useCase = new SignUpUseCase(
            userRepo.asIUserRepository(),
            hasher,
            authSession.asAuthSessionService(),
            eventBus.asIEventBus(),
            avatar.asIAvatarService()
        );
    });

    it('creates a user, publishes UserCreatedEvent, and returns a token on happy path', async () => {
        const result = await useCase.execute({
            email: 'new.user@example.com',
            password: 'pw',
            firstName: 'New',
            lastName: 'User',
            ip: '127.0.0.1',
            userAgent: 'ua'
        });

        assert.equal(result.success, true);
        if (!result.success) return;

        assert.equal(result.value.token, 'fake-jwt-token');
        assert.equal(result.value.user.email, 'new.user@example.com');
        assert.equal(result.value.user.firstName, 'new');
        assert.equal(result.value.user.lastName, 'user');

        // create was called with hashed password and default role.
        assert.equal(userRepo.createCalls.length, 1);
        assert.equal(userRepo.createCalls[0].password, 'hashed::pw');
        assert.equal(userRepo.createCalls[0].role, UserRole.User);

        // avatar pipeline.
        assert.equal(avatar.calls.length, 1);
        assert.equal(avatar.calls[0].seed, 'new.user@example.com');
        assert.equal(userRepo.updateByIdCalls.length, 1);
        assert.equal(userRepo.updateByIdCalls[0].data.avatar, 'https://fake-avatar/user.png');
        assert.equal(result.value.user.avatar, 'https://fake-avatar/user.png');

        // event published.
        assert.equal(eventBus.published.length, 1);
        assert.ok(eventBus.published[0] instanceof UserCreatedEvent);

        // session minted.
        assert.equal(authSession.calls.length, 1);
    });

    it('fails with conflict when the email is already registered', async () => {
        userRepo.seed({
            email: 'taken@example.com',
            password: 'hashed::x'
        });

        const result = await useCase.execute({
            email: 'taken@example.com',
            password: 'pw',
            firstName: 'Another',
            lastName: 'Person',
            ip: '127.0.0.1',
            userAgent: 'ua'
        });

        assert.equal(result.success, false);
        if (result.success) return;
        assert.equal(result.error.statusCode, 409);
        assert.equal(result.error.code, ErrorCodes.AUTH_CREDENTIALS_INVALID);
        assert.equal(hasher.hashCalls.length, 0);
        assert.equal(userRepo.createCalls.length, 0);
        assert.equal(eventBus.published.length, 0);
        assert.equal(authSession.calls.length, 0);
    });

    it('detects email collision even with different casing / whitespace', async () => {
        userRepo.seed({
            email: 'mixed@Example.com',
            password: 'hashed::x'
        });

        const result = await useCase.execute({
            email: '  MIXED@example.COM  ',
            password: 'pw',
            firstName: 'A',
            lastName: 'B',
            ip: '127.0.0.1',
            userAgent: 'ua'
        });

        assert.equal(result.success, false);
        if (result.success) return;
        assert.equal(result.error.statusCode, 409);
    });

    it('normalizes first/last name (trim + lowercase)', async () => {
        const result = await useCase.execute({
            email: 'norm@example.com',
            password: 'pw',
            firstName: '  Ada  ',
            lastName: '  LOVELACE',
            ip: '127.0.0.1',
            userAgent: 'ua'
        });

        assert.equal(result.success, true);
        if (!result.success) return;
        assert.equal(result.value.user.firstName, 'ada');
        assert.equal(result.value.user.lastName, 'lovelace');
    });

    it('hashes the password before persisting the user', async () => {
        await useCase.execute({
            email: 'hashme@example.com',
            password: 'plaintext-secret',
            firstName: 'H',
            lastName: 'M',
            ip: '127.0.0.1',
            userAgent: 'ua'
        });

        assert.deepEqual(hasher.hashCalls, ['plaintext-secret']);
        assert.equal(userRepo.createCalls[0].password, 'hashed::plaintext-secret');
    });

    it('publishes a UserCreatedEvent with the freshly assigned user id', async () => {
        const result = await useCase.execute({
            email: 'eventpayload@example.com',
            password: 'pw',
            firstName: 'E',
            lastName: 'P',
            ip: '127.0.0.1',
            userAgent: 'ua'
        });

        assert.equal(result.success, true);
        if (!result.success) return;

        assert.equal(eventBus.published.length, 1);
        const event = eventBus.published[0] as UserCreatedEvent;
        assert.equal(event.payload.email, 'eventpayload@example.com');
        assert.equal(event.payload.userId, result.value.user._id);
        assert.equal(event.payload.id, result.value.user._id);
    });
});
