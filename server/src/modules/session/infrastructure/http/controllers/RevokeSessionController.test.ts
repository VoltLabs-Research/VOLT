import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { container } from 'tsyringe';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { Result } from '@shared/domain/port/Result';
import { sessionValidation } from '@modules/session/infrastructure/http/validation/session-schemas';
import { getSessionRequestContext } from '@modules/session/infrastructure/http/helpers/getSessionRequestContext';
import type { IUseCase } from '@shared/application/IUseCase';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

interface MockResponse {
    statusCode: number;
    payload?: unknown;
    status(code: number): MockResponse;
    send(payload?: unknown): MockResponse;
    json(payload?: unknown): MockResponse;
}

class CaptureSessionRevokeInputUseCase implements IUseCase<Record<string, unknown>, void, never> {
    public input: Record<string, unknown> | null = null;

    async execute(input: Record<string, unknown>) {
        this.input = input;
        return Result.ok(undefined);
    }
}

const TestRevokeSessionController = createController(CaptureSessionRevokeInputUseCase, {
    statusCode: HttpStatus.NoContent,
    validationSchema: sessionValidation.revokeById,
    contextProviders: [getSessionRequestContext]
});

const createMockResponse = (): MockResponse => {
    return {
        statusCode: HttpStatus.OK,
        payload: undefined,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        send(payload?: unknown) {
            this.payload = payload;
            return this;
        },
        json(payload?: unknown) {
            this.payload = payload;
            return this;
        }
    };
};

test('RevokeSessionController keeps the route sessionId when request state also exposes a sessionId', async () => {
    const useCase = new CaptureSessionRevokeInputUseCase();
    container.registerInstance(CaptureSessionRevokeInputUseCase, useCase);

    const controller = new TestRevokeSessionController();
    const routeSessionId = '69b75e2b510018e40a3a0cb0';
    const currentSessionId = '69b75e2b510018e40a3a0cb1';
    const userId = '69b75e2b510018e40a3a0cb2';
    const request = {
        body: {},
        headers: {},
        params: { sessionId: routeSessionId },
        query: {},
        sessionId: currentSessionId,
        token: 'token-1',
        userId
    } as unknown as AuthenticatedRequest;
    const response = createMockResponse();

    await controller.handle(request, response as unknown as Response);

    assert.deepEqual(useCase.input, {
        authenticatedUserId: userId,
        data: {},
        file: undefined,
        files: undefined,
        sessionId: routeSessionId,
        token: 'token-1',
        userId
    });
    assert.equal(response.statusCode, HttpStatus.NoContent);
    assert.equal(response.payload, undefined);
});
