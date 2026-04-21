import 'reflect-metadata';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import CheckEmailUseCase from '@modules/auth/application/use-cases/CheckEmailUseCase';
import { FakeUserRepository } from './fakes';

describe('CheckEmailUseCase', () => {
    let userRepo: FakeUserRepository;
    let useCase: CheckEmailUseCase;

    beforeEach(() => {
        userRepo = new FakeUserRepository();
        useCase = new CheckEmailUseCase(userRepo.asIUserRepository());
    });

    it('returns { exists: true } when the email is registered', async () => {
        userRepo.seed({ email: 'known@example.com' });

        const result = await useCase.execute({ email: 'known@example.com' });

        assert.equal(result.success, true);
        if (!result.success) return;
        assert.equal(result.value.exists, true);
    });

    it('returns { exists: false } when the email is not registered', async () => {
        const result = await useCase.execute({ email: 'missing@example.com' });

        assert.equal(result.success, true);
        if (!result.success) return;
        assert.equal(result.value.exists, false);
    });

    it('is case-insensitive (seeded email matches lower-cased lookup)', async () => {
        userRepo.seed({ email: 'Case@Example.COM' });

        const result = await useCase.execute({ email: 'case@example.com' });

        assert.equal(result.success, true);
        if (!result.success) return;
        assert.equal(result.value.exists, true);
    });

    it('returns false for an empty string', async () => {
        const result = await useCase.execute({ email: '' });

        assert.equal(result.success, true);
        if (!result.success) return;
        assert.equal(result.value.exists, false);
    });

    it('does not fail for an email with unusual formatting', async () => {
        // The UseCase itself does not validate format — that is the controller's job.
        // It should simply report that the email is not registered.
        const result = await useCase.execute({ email: 'not-an-email' });

        assert.equal(result.success, true);
        if (!result.success) return;
        assert.equal(result.value.exists, false);
    });
});
