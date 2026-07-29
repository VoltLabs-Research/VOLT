import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { SelectQueryBuilder } from 'typeorm';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import SecretKey from '@modules/team/models/SecretKey';
import SecretKeyUsageLog from '@modules/team/models/SecretKeyUsageLog';
import Team from '@modules/team/models/Team';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import {
    getKeyUsageAnalytics,
    getTeamUsageAnalytics,
    logSecretKeyUsageRequest
} from '@modules/team/services/secret-key/SecretKeyUsageAnalyticsQueries';

interface Fixture{
    owner: User;
    team: Team;
    otherTeam: Team;
    role: TeamRole;
    otherRole: TeamRole;
    firstKey: SecretKey;
    secondKey: SecretKey;
    foreignKey: SecretKey;
}

interface SeedOptions{
    createdAt?: Date;
    method?: string;
    path?: string;
    statusCode?: number;
    responseTime?: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WIDE_WINDOW_DAYS = 4000;

const toSqliteUtc = (date: Date): string => date.toISOString().slice(0, 19).replace('T', ' ');

const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

const utcHourLabel = (date: Date): string => `${date.toISOString().slice(11, 13)}:00`;

describe('SecretKeyUsageAnalyticsQueries', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([
            SecretKey,
            SecretKeyUsageLog,
            Team,
            TeamRole,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
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

        const createKey = (teamId: string, roleId: string, name: string): Promise<SecretKey> => SecretKey.create({
            team: teamId,
            role: roleId,
            name,
            keyPrefix: `vsk_${name}`,
            keyHash: `hash-${name}`,
            createdBy: owner.id,
            isActive: true
        }).save();

        return {
            owner,
            team,
            otherTeam,
            role,
            otherRole,
            firstKey: await createKey(team.id, role.id, 'first'),
            secondKey: await createKey(team.id, role.id, 'second'),
            foreignKey: await createKey(otherTeam.id, otherRole.id, 'foreign')
        };
    };

    const seedLog = async (teamId: string, secretKeyId: string, options: SeedOptions = {}): Promise<SecretKeyUsageLog> => {
        const log = await SecretKeyUsageLog.create({
            team: teamId,
            secretKey: secretKeyId,
            method: options.method ?? 'GET',
            path: options.path ?? '/api/v1/trajectories',
            statusCode: options.statusCode ?? 200,
            responseTime: options.responseTime ?? 10,
            ip: '10.0.0.1',
            userAgent: 'volt-test'
        }).save();

        if(options.createdAt !== undefined){
            await dataSource.query(
                'UPDATE secret_key_usage_logs SET createdAt = ? WHERE id = ?',
                [toSqliteUtc(options.createdAt), log.id]
            );
        }

        return log;
    };

    describe('logSecretKeyUsageRequest', () => {
        it('persists one usage row per request', async () => {
            const fixture = await createFixture();

            await logSecretKeyUsageRequest({
                team: fixture.team.id,
                secretKey: fixture.firstKey.id,
                method: 'POST',
                path: '/api/v1/analysis',
                statusCode: 201,
                responseTime: 42,
                ip: '10.0.0.9',
                userAgent: 'volt-cli'
            });

            const stored = await SecretKeyUsageLog.findOneByOrFail({ secretKey: fixture.firstKey.id });
            assert.equal(stored.method, 'POST');
            assert.equal(stored.path, '/api/v1/analysis');
            assert.equal(stored.statusCode, 201);
            assert.equal(stored.responseTime, 42);
            assert.equal(stored.team, fixture.team.id);
        });
    });

    describe('getTeamUsageAnalytics', () => {
        it('returns the complete empty payload for a team without usage', async () => {
            const fixture = await createFixture();

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.deepEqual(analytics, {
                overview: {
                    totalRequests: 0,
                    successRequests: 0,
                    avgResponseTime: 0
                },
                perKey: [],
                daily: [],
                topEndpoints: []
            });
        });

        it('counts only the 2xx responses as successful in the overview', async () => {
            const fixture = await createFixture();
            for(const statusCode of [200, 201, 299, 199, 300, 404, 500]){
                await seedLog(fixture.team.id, fixture.firstKey.id, { statusCode });
            }

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.equal(analytics.overview.totalRequests, 7);
            assert.equal(analytics.overview.successRequests, 3);
        });

        it('reports the mean response time of the window in the overview', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { responseTime: 10 });
            await seedLog(fixture.team.id, fixture.firstKey.id, { responseTime: 20 });
            await seedLog(fixture.team.id, fixture.secondKey.id, { responseTime: 60 });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.equal(analytics.overview.avgResponseTime, 30);
        });

        it('returns numbers for every aggregated counter', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { responseTime: 15 });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.equal(typeof analytics.overview.totalRequests, 'number');
            assert.equal(typeof analytics.overview.successRequests, 'number');
            assert.equal(typeof analytics.overview.avgResponseTime, 'number');
            assert.equal(typeof analytics.perKey[0].totalRequests, 'number');
            assert.equal(typeof analytics.perKey[0].successRequests, 'number');
            assert.equal(typeof analytics.perKey[0].avgResponseTime, 'number');
            assert.equal(typeof analytics.daily[0].count, 'number');
            assert.equal(typeof analytics.topEndpoints[0].count, 'number');
            assert.equal(typeof analytics.topEndpoints[0].avgResponseTime, 'number');
            assert.equal(typeof analytics.topEndpoints[0].successRate, 'number');
        });

        it('reports one perKey row per secret key ordered by request volume', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id);
            await seedLog(fixture.team.id, fixture.secondKey.id);
            await seedLog(fixture.team.id, fixture.secondKey.id);
            await seedLog(fixture.team.id, fixture.secondKey.id);

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.deepEqual(analytics.perKey.map((row) => row.secretKeyId), [fixture.secondKey.id, fixture.firstKey.id]);
            assert.deepEqual(analytics.perKey.map((row) => row.totalRequests), [3, 1]);
        });

        it('reports the last request of each key as a date', async () => {
            const fixture = await createFixture();
            const oldest = new Date('2024-03-05T07:08:09.000Z');
            const newest = new Date('2024-03-07T21:00:00.000Z');
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: oldest });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: newest });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, WIDE_WINDOW_DAYS);

            assert.ok(analytics.perKey[0].lastRequestAt instanceof Date);
            assert.equal(analytics.perKey[0].lastRequestAt?.toISOString(), newest.toISOString());
        });

        it('splits the perKey success and latency figures per key', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                statusCode: 200,
                responseTime: 100
            });
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                statusCode: 500,
                responseTime: 200
            });
            await seedLog(fixture.team.id, fixture.secondKey.id, {
                statusCode: 204,
                responseTime: 8
            });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);
            const first = analytics.perKey.find((row) => row.secretKeyId === fixture.firstKey.id);
            const second = analytics.perKey.find((row) => row.secretKeyId === fixture.secondKey.id);

            assert.deepEqual([first?.successRequests, first?.avgResponseTime], [1, 150]);
            assert.deepEqual([second?.successRequests, second?.avgResponseTime], [1, 8]);
        });

        it('groups the daily series by UTC day and secret key', async () => {
            const fixture = await createFixture();
            const firstDayMorning = new Date('2024-03-05T00:30:00.000Z');
            const firstDayNight = new Date('2024-03-05T23:45:00.000Z');
            const secondDay = new Date('2024-03-06T12:00:00.000Z');
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: firstDayMorning });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: firstDayNight });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: secondDay });
            await seedLog(fixture.team.id, fixture.secondKey.id, { createdAt: secondDay });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, WIDE_WINDOW_DAYS);

            assert.deepEqual(analytics.daily, [
                {
                    date: utcDay(firstDayMorning),
                    secretKeyId: fixture.firstKey.id,
                    count: 2
                },
                {
                    date: utcDay(secondDay),
                    secretKeyId: fixture.firstKey.id,
                    count: 1
                },
                {
                    date: utcDay(secondDay),
                    secretKeyId: fixture.secondKey.id,
                    count: 1
                }
            ]);
        });

        it('orders the daily series chronologically', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date('2024-03-09T10:00:00.000Z') });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date('2024-03-01T10:00:00.000Z') });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date('2024-03-05T10:00:00.000Z') });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, WIDE_WINDOW_DAYS);

            assert.deepEqual(analytics.daily.map((row) => row.date), ['2024-03-01', '2024-03-05', '2024-03-09']);
        });

        it('ranks the top endpoints by request count', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { path: '/api/v1/rare' });
            for(let index = 0; index < 3; index++){
                await seedLog(fixture.team.id, fixture.firstKey.id, { path: '/api/v1/busy' });
            }

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.deepEqual(analytics.topEndpoints.map((endpoint) => endpoint.path), ['/api/v1/busy', '/api/v1/rare']);
            assert.deepEqual(analytics.topEndpoints.map((endpoint) => endpoint.count), [3, 1]);
        });

        it('separates the endpoints by method', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                method: 'GET',
                path: '/api/v1/trajectories'
            });
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                method: 'POST',
                path: '/api/v1/trajectories'
            });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.deepEqual(
                analytics.topEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`).sort(),
                ['GET /api/v1/trajectories', 'POST /api/v1/trajectories']
            );
        });

        it('rounds the endpoint success rate to a tenth of a percent', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { statusCode: 200 });
            await seedLog(fixture.team.id, fixture.firstKey.id, { statusCode: 500 });
            await seedLog(fixture.team.id, fixture.firstKey.id, { statusCode: 500 });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.equal(analytics.topEndpoints[0].successRate, 33.3);
        });

        it('reports a zero success rate for an endpoint without 2xx responses', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { statusCode: 503 });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.equal(analytics.topEndpoints[0].successRate, 0);
        });

        it('rounds the endpoint average response time to an integer', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { responseTime: 10 });
            await seedLog(fixture.team.id, fixture.firstKey.id, { responseTime: 11 });
            await seedLog(fixture.team.id, fixture.firstKey.id, { responseTime: 11 });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.equal(analytics.topEndpoints[0].avgResponseTime, 11);
        });

        it('caps the top endpoints at ten rows', async () => {
            const fixture = await createFixture();
            for(let index = 0; index < 12; index++){
                await seedLog(fixture.team.id, fixture.firstKey.id, { path: `/api/v1/route-${index}` });
            }

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.equal(analytics.topEndpoints.length, 10);
        });

        it('excludes the requests older than the requested window', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 2 * HOUR) });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 40 * DAY) });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.equal(analytics.overview.totalRequests, 1);
            assert.equal(analytics.daily.length, 1);
        });

        it('excludes the usage logged by the other teams', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id);
            await seedLog(fixture.otherTeam.id, fixture.foreignKey.id);

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.equal(analytics.overview.totalRequests, 1);
            assert.deepEqual(analytics.perKey.map((row) => row.secretKeyId), [fixture.firstKey.id]);
        });
    });

    describe('getKeyUsageAnalytics', () => {
        it('returns the complete empty payload for a key without usage', async () => {
            const fixture = await createFixture();

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.deepEqual(analytics, {
                overview: {
                    totalRequests: 0,
                    successRequests: 0,
                    avgResponseTime: 0,
                    requests24h: 0,
                    requests7d: 0
                },
                hourly: [],
                daily: [],
                endpoints: [],
                statusDistribution: [],
                peakHour: null,
                recentRequests: []
            });
        });

        it('counts the requests of the last 24 hours within their own window', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 2 * HOUR) });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 3 * DAY) });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 10 * DAY) });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.equal(analytics.overview.totalRequests, 3);
            assert.equal(analytics.overview.requests24h, 1);
        });

        it('counts the requests of the last 7 days within their own window', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 2 * HOUR) });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 3 * DAY) });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 10 * DAY) });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.equal(analytics.overview.requests7d, 2);
        });

        it('never counts outside the requested window in the shorter windows', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 2 * HOUR) });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 0);

            assert.equal(analytics.overview.totalRequests, 0);
            assert.equal(analytics.overview.requests24h, 0);
            assert.equal(analytics.overview.requests7d, 0);
        });

        it('reports the 2xx count and the mean latency of the key', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                statusCode: 200,
                responseTime: 30
            });
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                statusCode: 404,
                responseTime: 90
            });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.equal(analytics.overview.successRequests, 1);
            assert.equal(analytics.overview.avgResponseTime, 60);
        });

        it('buckets the last 24 hours by UTC hour', async () => {
            const fixture = await createFixture();
            const busyHour = new Date(Date.now() - 3 * HOUR);
            const quietHour = new Date(Date.now() - 6 * HOUR);
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: busyHour });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: busyHour });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: quietHour });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);
            const buckets = new Map(analytics.hourly.map((bucket) => [bucket.label, bucket.count]));

            assert.equal(analytics.hourly.length, 2);
            assert.equal(buckets.get(utcHourLabel(busyHour)), 2);
            assert.equal(buckets.get(utcHourLabel(quietHour)), 1);
        });

        it('leaves the hourly series empty when the last 24 hours had no traffic', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 3 * DAY) });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.deepEqual(analytics.hourly, []);
        });

        it('reports the busiest UTC hour of the last 24 hours as a number', async () => {
            const fixture = await createFixture();
            const busyHour = new Date(Date.now() - 3 * HOUR);
            const quietHour = new Date(Date.now() - 6 * HOUR);
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: busyHour });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: busyHour });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: quietHour });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.equal(analytics.peakHour, busyHour.getUTCHours());
            assert.equal(typeof analytics.peakHour, 'number');
        });

        it('reports a null peak hour when the last 24 hours had no traffic', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: new Date(Date.now() - 3 * DAY) });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.equal(analytics.peakHour, null);
        });

        it('groups the daily series of the key by UTC day', async () => {
            const fixture = await createFixture();
            const firstDay = new Date('2024-03-05T23:50:00.000Z');
            const secondDay = new Date('2024-03-06T00:10:00.000Z');
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: firstDay });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: secondDay });
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt: secondDay });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, WIDE_WINDOW_DAYS);

            assert.deepEqual(analytics.daily, [
                {
                    label: utcDay(firstDay),
                    count: 1
                },
                {
                    label: utcDay(secondDay),
                    count: 2
                }
            ]);
        });

        it('reports the status code distribution ordered by code', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, { statusCode: 500 });
            await seedLog(fixture.team.id, fixture.firstKey.id, { statusCode: 200 });
            await seedLog(fixture.team.id, fixture.firstKey.id, { statusCode: 200 });
            await seedLog(fixture.team.id, fixture.firstKey.id, { statusCode: 404 });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.deepEqual(analytics.statusDistribution, [
                {
                    code: 200,
                    count: 2
                },
                {
                    code: 404,
                    count: 1
                },
                {
                    code: 500,
                    count: 1
                }
            ]);
        });

        it('lists every endpoint of the key without the ten row cap', async () => {
            const fixture = await createFixture();
            for(let index = 0; index < 12; index++){
                await seedLog(fixture.team.id, fixture.firstKey.id, { path: `/api/v1/route-${index}` });
            }

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.equal(analytics.endpoints.length, 12);
        });

        it('lists the most recent requests first', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                path: '/api/v1/oldest',
                createdAt: new Date('2024-03-05T10:00:00.000Z')
            });
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                path: '/api/v1/newest',
                createdAt: new Date('2024-03-07T10:00:00.000Z')
            });
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                path: '/api/v1/middle',
                createdAt: new Date('2024-03-06T10:00:00.000Z')
            });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, WIDE_WINDOW_DAYS);

            assert.deepEqual(
                analytics.recentRequests.map((request) => request.path),
                ['/api/v1/newest', '/api/v1/middle', '/api/v1/oldest']
            );
        });

        it('caps the recent requests at fifty rows', async () => {
            const fixture = await createFixture();
            for(let index = 0; index < 55; index++){
                await seedLog(fixture.team.id, fixture.firstKey.id);
            }

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.equal(analytics.recentRequests.length, 50);
        });

        it('exposes the request metadata of every recent row', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                method: 'DELETE',
                path: '/api/v1/analysis/1',
                statusCode: 204,
                responseTime: 7
            });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.equal(analytics.recentRequests[0].method, 'DELETE');
            assert.equal(analytics.recentRequests[0].path, '/api/v1/analysis/1');
            assert.equal(analytics.recentRequests[0].statusCode, 204);
            assert.equal(analytics.recentRequests[0].responseTime, 7);
            assert.equal(analytics.recentRequests[0].ip, '10.0.0.1');
            assert.ok(analytics.recentRequests[0].createdAt instanceof Date);
        });

        it('ignores the usage of the other keys of the same team', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id);
            await seedLog(fixture.team.id, fixture.secondKey.id);
            await seedLog(fixture.team.id, fixture.secondKey.id);

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.equal(analytics.overview.totalRequests, 1);
            assert.equal(analytics.recentRequests.length, 1);
        });
    });

    describe('driver counters that arrive as strings', () => {
        const originalGetRawMany = SelectQueryBuilder.prototype.getRawMany;

        before(() => {
            SelectQueryBuilder.prototype.getRawMany = async function stringifyCounters(this: SelectQueryBuilder<never>){
                const rows: unknown[] = await originalGetRawMany.call(this);

                return rows.map((row) => Object.fromEntries(
                    Object.entries(row as Record<string, unknown>).map(([key, value]) => [
                        key,
                        typeof value === 'number' ? String(value) : value
                    ])
                ));
            } as typeof SelectQueryBuilder.prototype.getRawMany;
        });

        after(() => {
            SelectQueryBuilder.prototype.getRawMany = originalGetRawMany;
        });

        it('receives the raw counters as text while the driver double is active', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id);

            const row = await SecretKeyUsageLog.createQueryBuilder('log')
                .select('COUNT(log.id)', 'total')
                .getRawOne<{ total: unknown }>();

            assert.equal(typeof row?.total, 'string');
        });

        it('normalizes the team analytics counters into numbers', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                statusCode: 200,
                responseTime: 10
            });
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                statusCode: 500,
                responseTime: 30
            });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, 30);

            assert.deepEqual(analytics.overview, {
                totalRequests: 2,
                successRequests: 1,
                avgResponseTime: 20
            });
            assert.equal(analytics.perKey[0].totalRequests, 2);
            assert.equal(analytics.perKey[0].successRequests, 1);
            assert.equal(analytics.perKey[0].avgResponseTime, 20);
            assert.equal(analytics.daily[0].count, 2);
            assert.equal(analytics.topEndpoints[0].count, 2);
            assert.equal(analytics.topEndpoints[0].avgResponseTime, 20);
            assert.equal(analytics.topEndpoints[0].successRate, 50);
        });

        it('normalizes the key analytics counters into numbers', async () => {
            const fixture = await createFixture();
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                statusCode: 200,
                responseTime: 10,
                createdAt: new Date(Date.now() - 2 * HOUR)
            });
            await seedLog(fixture.team.id, fixture.firstKey.id, {
                statusCode: 404,
                responseTime: 30,
                createdAt: new Date(Date.now() - 2 * HOUR)
            });

            const analytics = await getKeyUsageAnalytics(fixture.firstKey.id, 30);

            assert.deepEqual(analytics.overview, {
                totalRequests: 2,
                successRequests: 1,
                avgResponseTime: 20,
                requests24h: 2,
                requests7d: 2
            });
            assert.equal(analytics.hourly[0].count, 2);
            assert.equal(analytics.daily[0].count, 2);
            assert.deepEqual(analytics.statusDistribution, [
                {
                    code: 200,
                    count: 1
                },
                {
                    code: 404,
                    count: 1
                }
            ]);
            assert.equal(typeof analytics.peakHour, 'number');
        });

        it('parses the last request timestamp of a driver that returns it as text', async () => {
            const fixture = await createFixture();
            const createdAt = new Date('2024-03-07T21:00:00.000Z');
            await seedLog(fixture.team.id, fixture.firstKey.id, { createdAt });

            const analytics = await getTeamUsageAnalytics(fixture.team.id, WIDE_WINDOW_DAYS);

            assert.ok(analytics.perKey[0].lastRequestAt instanceof Date);
            assert.equal(analytics.perKey[0].lastRequestAt?.toISOString(), createdAt.toISOString());
        });
    });
});
