import 'reflect-metadata';

import Session, { SessionActivityType } from '@modules/session/domain/entities/Session';
import { toPersistedSessionDTO } from '@modules/session/application/dtos/PersistedSessionDTO';
import assert from 'node:assert/strict';
import test from 'node:test';

test('toPersistedSessionDTO redacts raw session tokens', () => {
    const session = new Session('session-id', {
        user: 'user-id',
        token: 'raw-session-token',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        isActive: true,
        lastActivity: new Date(),
        action: SessionActivityType.Login,
        success: true,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    const dto = toPersistedSessionDTO(session);

    assert.equal(dto._id, 'session-id');
    assert.equal(dto.token, null);
});
