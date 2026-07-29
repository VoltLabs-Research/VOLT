import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import crypto from 'node:crypto';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import ApplicationError from '@shared/application/errors/ApplicationError';
import SecretKey from '@modules/team/models/SecretKey';
import SecretKeyService from '@modules/team/services/SecretKeyService';
import SecretKeyUsageLog from '@modules/team/models/SecretKeyUsageLog';
import Team from '@modules/team/models/Team';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface Fixture{
    owner: User;
    team: Team;
    otherTeam: Team;
    role: TeamRole;
    otherRole: TeamRole;
}

interface EnrichedPerKeyRow{
    secretKeyId: string;
    name: string;
    keyPrefix: string;
    roleName: string;
    isActive: boolean;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: Date | null;
}

const HOUR = 60 * 60 * 1000;

describe('SecretKeyService', () => {
    let dataSource: DataSource;
    const service = new SecretKeyService();
    const published: EmittedEvent[] = [];

    before(async () => {
        dataSource = await createHarness([
            SecretKey,
            SecretKeyUsageLog,
            Team,
            TeamRole,
            User
        ]);

        eventBus.emit = (async (name: string, payload: unknown) => {
            published.push({
                name,
                payload
            });
        }) as typeof eventBus.emit;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            password: 'hashed-secret',
            firstName: 'ada',
            lastName: 'lovelace',
            avatar: 'avatar.png'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const otherTeam = await Team.create({
            name: 'Team Two',
            owner: owner.id
        }).save();
        const role = await TeamRole.create({
            team: team.id,
            name: 'Owner',
            permissions: ['*'],
            isSystem: true
        }).save();
        const otherRole = await TeamRole.create({
            team: otherTeam.id,
            name: 'Owner',
            permissions: ['*'],
            isSystem: true
        }).save();

        return {
            owner,
            team,
            otherTeam,
            role,
            otherRole
        };
    };

    const seedKey = (fixture: Fixture, name: string, overrides: Partial<SecretKey> = {}): Promise<SecretKey> => SecretKey.create({
        team: fixture.team.id,
        role: fixture.role.id,
        name,
        keyPrefix: `vsk_${name}`,
        keyHash: `hash-${name}`,
        createdBy: fixture.owner.id,
        isActive: true,
        ...overrides
    }).save();

    const seedLog = (fixture: Fixture, secretKeyId: string, statusCode: number, responseTime: number): Promise<SecretKeyUsageLog> => SecretKeyUsageLog.create({
        team: fixture.team.id,
        secretKey: secretKeyId,
        method: 'GET',
        path: '/api/v1/trajectories',
        statusCode,
        responseTime
    }).save();

    describe('create', () => {
        it('returns the plaintext key once and stores only its hash', async () => {
            const fixture = await createFixture();

            const result = await service.create(fixture.team.id, fixture.owner.id, {
                roleId: fixture.role.id,
                name: 'ci'
            });

            assert.match(result.secretKey, /^vsk_[0-9a-f]{64}$/);
            assert.equal(result.keyPrefix, result.secretKey.slice(0, 14));
            const stored = await SecretKey.findOneByOrFail({ id: result.secretKeyId });
            assert.equal(stored.keyHash, crypto.createHash('sha256').update(result.secretKey).digest('hex'));
            assert.equal(stored.keyPrefix, result.keyPrefix);
        });

        it('keeps the key hash out of the wire payload', async () => {
            const fixture = await createFixture();
            const result = await service.create(fixture.team.id, fixture.owner.id, {
                roleId: fixture.role.id,
                name: 'ci'
            });

            const stored = await SecretKey.findOneByOrFail({ id: result.secretKeyId });

            assert.equal('keyHash' in stored.toJSON(), false);
            assert.equal(stored.toJSON()._id, stored.id);
            assert.equal('id' in stored.toJSON(), false);
        });

        it('emits secret-key.created', async () => {
            const fixture = await createFixture();

            const result = await service.create(fixture.team.id, fixture.owner.id, {
                roleId: fixture.role.id,
                name: 'ci'
            });

            assert.deepEqual(published, [{
                name: 'secret-key.created',
                payload: {
                    secretKeyId: result.secretKeyId,
                    teamId: fixture.team.id,
                    name: 'ci',
                    userId: fixture.owner.id
                }
            }]);
        });

        it('rejects a role that belongs to another team', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.create(fixture.team.id, fixture.owner.id, {
                    roleId: fixture.otherRole.id,
                    name: 'ci'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::NotFound');
                    assert.equal(error.message, 'Team role not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('rejects an unknown role', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.create(fixture.team.id, fixture.owner.id, {
                    roleId: '6a69587bbabeab928d9147ba',
                    name: 'ci'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamRole::NotFound');
                    return true;
                }
            );
        });

        it('issues a distinct key on every call', async () => {
            const fixture = await createFixture();

            const first = await service.create(fixture.team.id, fixture.owner.id, {
                roleId: fixture.role.id,
                name: 'first'
            });
            const second = await service.create(fixture.team.id, fixture.owner.id, {
                roleId: fixture.role.id,
                name: 'second'
            });

            assert.notEqual(first.secretKey, second.secretKey);
            assert.equal(await SecretKey.countBy({ team: fixture.team.id }), 2);
        });
    });

    describe('current', () => {
        it('describes the authenticated key without its hash', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');

            const result = await service.current('secret-key', key.id);

            assert.deepEqual(Object.keys(result).sort(), [
                '_id',
                'team',
                'role',
                'createdBy',
                'name',
                'keyPrefix',
                'isActive',
                'lastUsedAt',
                'createdAt',
                'updatedAt'
            ].sort());
            assert.equal(result._id, key.id);
        });

        it('rejects a request that did not authenticate with a secret key', async () => {
            await assert.rejects(
                () => service.current('user', 'some-key'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Authentication::Required');
                    assert.equal(error.message, 'Secret key authentication required');
                    assert.equal(error.statusCode, 401);
                    return true;
                }
            );
        });

        it('rejects a request without a key identifier', async () => {
            await assert.rejects(
                () => service.current('secret-key', undefined),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'Authentication::Required');
                    return true;
                }
            );
        });

        it('rejects an unknown key', async () => {
            await assert.rejects(
                () => service.current('secret-key', '6a69587bbabeab928d9147ba'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'SecretKey::Invalid');
                    assert.equal(error.message, 'Secret key not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });

    describe('listByTeamId', () => {
        it('projects the creator to its public identity only', async () => {
            const fixture = await createFixture();
            await seedKey(fixture, 'ci');

            const result = await service.listByTeamId(fixture.team.id);
            const createdBy = result.data[0].createdBy as Record<string, unknown>;

            assert.deepEqual(Object.keys(createdBy).sort(), ['_id', 'firstName', 'lastName', 'email', 'avatar'].sort());
            assert.equal('password' in createdBy, false);
            assert.equal('teams' in createdBy, false);
        });

        it('never exposes the key hash of a listed key', async () => {
            const fixture = await createFixture();
            await seedKey(fixture, 'ci');

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal('keyHash' in result.data[0], false);
            assert.equal('id' in result.data[0], false);
            assert.equal(result.data[0].roleName, 'Owner');
        });

        it('orders the keys from the newest to the oldest', async () => {
            const fixture = await createFixture();
            const oldest = await seedKey(fixture, 'oldest');
            const newest = await seedKey(fixture, 'newest');
            await SecretKey.update({ id: oldest.id }, { createdAt: new Date('2024-01-01T00:00:00.000Z') });
            await SecretKey.update({ id: newest.id }, { createdAt: new Date('2024-06-01T00:00:00.000Z') });

            const result = await service.listByTeamId(fixture.team.id);

            assert.deepEqual(result.data.map((key) => key.name), ['newest', 'oldest']);
        });

        it('excludes the keys of the other teams', async () => {
            const fixture = await createFixture();
            await seedKey(fixture, 'mine');
            await SecretKey.create({
                team: fixture.otherTeam.id,
                role: fixture.otherRole.id,
                name: 'foreign',
                keyPrefix: 'vsk_foreign',
                keyHash: 'hash-foreign',
                createdBy: fixture.owner.id,
                isActive: true
            }).save();

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.total, 1);
            assert.equal(result.data[0].name, 'mine');
        });

        it('defaults to a limit of fifty rows', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.limit, 50);
            assert.equal(result.page, 1);
        });

        it('caps the limit at two hundred rows', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listByTeamId(fixture.team.id, 1, 900)).limit, 200);
        });

        it('slices the requested page', async () => {
            const fixture = await createFixture();
            await seedKey(fixture, 'first');
            await seedKey(fixture, 'second');
            await seedKey(fixture, 'third');

            const result = await service.listByTeamId(fixture.team.id, 2, 2);

            assert.equal(result.data.length, 1);
            assert.equal(result.total, 3);
            assert.equal(result.totalPages, 2);
        });
    });

    describe('revokeById', () => {
        it('deactivates the key without deleting it', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');

            const result = await service.revokeById(fixture.team.id, key.id);

            assert.equal(result.isActive, false);
            assert.equal(result._id, key.id);
            assert.equal((await SecretKey.findOneByOrFail({ id: key.id })).isActive, false);
        });

        it('rejects a key that belongs to another team', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');

            await assert.rejects(
                () => service.revokeById(fixture.otherTeam.id, key.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'SecretKey::NotFound');
                    assert.equal(error.message, 'Secret key not found');
                    return true;
                }
            );
            assert.equal((await SecretKey.findOneByOrFail({ id: key.id })).isActive, true);
        });
    });

    describe('deleteById', () => {
        it('removes the key and emits secret-key.deleted', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');

            await service.deleteById(fixture.team.id, key.id, fixture.owner.id);

            assert.equal(await SecretKey.countBy({ id: key.id }), 0);
            assert.deepEqual(published, [{
                name: 'secret-key.deleted',
                payload: {
                    secretKeyId: key.id,
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    secretKeyName: 'ci'
                }
            }]);
        });

        it('cascades the deletion to the usage logs of the key', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');
            await seedLog(fixture, key.id, 200, 10);

            await service.deleteById(fixture.team.id, key.id, fixture.owner.id);

            assert.equal(await SecretKeyUsageLog.countBy({ secretKey: key.id }), 0);
        });

        it('rejects a call without an acting user', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');

            await assert.rejects(
                () => service.deleteById(fixture.team.id, key.id, ''),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'SecretKey::ParamsRequired');
                    assert.equal(error.message, 'User ID is required');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });

        it('rejects a key that belongs to another team', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');

            await assert.rejects(
                () => service.deleteById(fixture.otherTeam.id, key.id, fixture.owner.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'SecretKey::NotFound');
                    return true;
                }
            );
            assert.equal(await SecretKey.countBy({ id: key.id }), 1);
        });
    });

    describe('teamMetrics', () => {
        it('reports the overview success rate as a rounded percentage', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');
            await seedLog(fixture, key.id, 200, 10);
            await seedLog(fixture, key.id, 500, 20);
            await seedLog(fixture, key.id, 500, 30);

            const metrics = await service.teamMetrics(fixture.team.id);
            const overview = metrics.overview as Record<string, unknown>;

            assert.equal(overview.totalRequests, 3);
            assert.equal(overview.successRate, 33.3);
            assert.equal(overview.avgResponseTime, 20);
        });

        it('counts the active and revoked keys of the team', async () => {
            const fixture = await createFixture();
            await seedKey(fixture, 'active');
            await seedKey(fixture, 'revoked', { isActive: false });

            const metrics = await service.teamMetrics(fixture.team.id);

            assert.equal(metrics.totalKeys, 2);
            assert.equal(metrics.activeKeys, 1);
            assert.equal(metrics.revokedKeys, 1);
        });

        it('enriches every key with its role name even without usage', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'idle');

            const metrics = await service.teamMetrics(fixture.team.id);
            const perKey = metrics.perKey as EnrichedPerKeyRow[];

            assert.deepEqual(perKey, [{
                secretKeyId: key.id,
                name: 'idle',
                keyPrefix: 'vsk_idle',
                roleName: 'Owner',
                isActive: true,
                totalRequests: 0,
                successRequests: 0,
                avgResponseTime: 0,
                lastRequestAt: null
            }]);
        });

        it('falls back to the stored lastUsedAt of a key without usage logs', async () => {
            const fixture = await createFixture();
            const lastUsedAt = new Date('2024-03-05T07:08:09.000Z');
            await seedKey(fixture, 'idle', { lastUsedAt });

            const metrics = await service.teamMetrics(fixture.team.id);
            const perKey = metrics.perKey as EnrichedPerKeyRow[];

            assert.equal(perKey[0].lastRequestAt?.toISOString(), lastUsedAt.toISOString());
        });

        it('sorts the enriched keys by request volume', async () => {
            const fixture = await createFixture();
            const busy = await seedKey(fixture, 'busy');
            const idle = await seedKey(fixture, 'idle');
            await seedLog(fixture, busy.id, 200, 10);
            await seedLog(fixture, busy.id, 200, 10);

            const metrics = await service.teamMetrics(fixture.team.id);
            const perKey = metrics.perKey as EnrichedPerKeyRow[];

            assert.deepEqual(perKey.map((row) => row.secretKeyId), [busy.id, idle.id]);
            assert.deepEqual(perKey.map((row) => row.totalRequests), [2, 0]);
        });

        it('builds one daily label with a total and a per key series', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');
            await seedLog(fixture, key.id, 200, 10);
            await seedLog(fixture, key.id, 200, 10);

            const metrics = await service.teamMetrics(fixture.team.id);
            const daily = metrics.daily as {
                labels: string[];
                total: number[];
                byKey: Record<string, number[]>;
            };

            assert.equal(daily.labels.length, 1);
            assert.deepEqual(daily.total, [2]);
            assert.deepEqual(daily.byKey[key.id], [2]);
        });

        it('reports a zero success rate and empty series for a team without usage', async () => {
            const fixture = await createFixture();

            const metrics = await service.teamMetrics(fixture.team.id);
            const overview = metrics.overview as Record<string, unknown>;
            const daily = metrics.daily as { labels: string[]; total: number[] };

            assert.equal(overview.totalRequests, 0);
            assert.equal(overview.successRate, 0);
            assert.equal(overview.avgResponseTime, 0);
            assert.deepEqual(daily.labels, []);
            assert.deepEqual(metrics.topEndpoints, []);
            assert.deepEqual(metrics.perKey, []);
        });

        it('resolves the window from the requested day count', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');
            const log = await seedLog(fixture, key.id, 200, 10);
            await dataSource.query(
                'UPDATE secret_key_usage_logs SET createdAt = ? WHERE id = ?',
                [new Date(Date.now() - 10 * 24 * HOUR).toISOString().slice(0, 19).replace('T', ' '), log.id]
            );

            const inside = await service.teamMetrics(fixture.team.id, 30);
            const outside = await service.teamMetrics(fixture.team.id, 1);

            assert.equal((inside.overview as Record<string, unknown>).totalRequests, 1);
            assert.equal((outside.overview as Record<string, unknown>).totalRequests, 0);
        });
    });

    describe('keyUsage', () => {
        it('describes the key and its usage statistics', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');
            await seedLog(fixture, key.id, 200, 10);
            await seedLog(fixture, key.id, 404, 30);

            const usage = await service.keyUsage(fixture.team.id, key.id);
            const keyView = usage.key as Record<string, unknown>;
            const stats = usage.stats as Record<string, unknown>;

            assert.deepEqual(Object.keys(keyView).sort(), [
                '_id',
                'name',
                'keyPrefix',
                'roleName',
                'isActive',
                'createdAt',
                'lastUsedAt'
            ].sort());
            assert.equal(keyView.roleName, 'Owner');
            assert.equal(stats.totalRequests, 2);
            assert.equal(stats.successRate, 50);
            assert.equal(stats.avgResponseTime, 20);
        });

        it('formats the peak hour as a two digit label', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');
            await seedLog(fixture, key.id, 200, 10);

            const usage = await service.keyUsage(fixture.team.id, key.id);
            const stats = usage.stats as Record<string, unknown>;

            assert.match(String(stats.peakHour), /^\d{2}:00$/);
        });

        it('reports a placeholder peak hour without recent traffic', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');

            const usage = await service.keyUsage(fixture.team.id, key.id);
            const stats = usage.stats as Record<string, unknown>;

            assert.equal(stats.peakHour, '--:--');
            assert.equal(stats.totalRequests, 0);
            assert.equal(stats.successRate, 0);
        });

        it('splits the hourly and daily series into labels and data', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');
            await seedLog(fixture, key.id, 200, 10);

            const usage = await service.keyUsage(fixture.team.id, key.id);
            const hourly = usage.hourly as { labels: string[]; data: number[] };
            const daily = usage.daily as { labels: string[]; data: number[] };

            assert.equal(hourly.labels.length, 1);
            assert.deepEqual(hourly.data, [1]);
            assert.match(hourly.labels[0], /^\d{2}:00$/);
            assert.deepEqual(daily.data, [1]);
        });

        it('rejects a key that belongs to another team', async () => {
            const fixture = await createFixture();
            const key = await seedKey(fixture, 'ci');

            await assert.rejects(
                () => service.keyUsage(fixture.otherTeam.id, key.id),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'SecretKey::NotFound');
                    assert.equal(error.message, 'Secret key not found');
                    return true;
                }
            );
        });

        it('rejects an unknown key', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.keyUsage(fixture.team.id, '6a69587bbabeab928d9147ba'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'SecretKey::NotFound');
                    return true;
                }
            );
        });
    });
});
