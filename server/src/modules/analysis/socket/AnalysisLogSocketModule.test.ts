import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import Analysis from '@modules/analysis/models/Analysis';
import Plugin from '@modules/plugin/models/Plugin';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { AnalysisLogSocketModule } from '@modules/analysis/socket/AnalysisLogSocketModule';
import analysisExecutionLogService, { ANALYSIS_LOG_SOCKET_EVENTS } from '@modules/analysis/services/AnalysisExecutionLogService';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import type { ISocketConnection, SocketEventHandler } from '@modules/socket/socket/ISocketModule';
import { ErrorCodes } from '@core/constants/error-codes';

interface EmittedMessage{
    socketId: string;
    event: string;
    data: unknown;
}

interface RoomChange{
    socketId: string;
    room: string;
}

interface TeamFixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
    trajectory: Trajectory;
    plugin: Plugin;
}

interface FrameLogReply{
    analysisId: string;
    timestep: number;
    segments: Array<Record<string, unknown>>;
    sealed: boolean;
    truncated: boolean;
    nextCursor?: string;
    status?: string;
}

const SOCKET_ID = 'socket-1';

describe('AnalysisLogSocketModule', () => {
    let dataSource: DataSource;
    const socketModule = new AnalysisLogSocketModule();
    const handlers = new Map<string, SocketEventHandler<never, unknown>>();
    const emitted: EmittedMessage[] = [];
    const joinedRooms: RoomChange[] = [];
    const leftRooms: RoomChange[] = [];
    const frameLogCalls: Record<string, unknown>[] = [];
    let frameLogReply: FrameLogReply;

    before(async () => {
        dataSource = await createHarness([
            Analysis,
            Plugin,
            Trajectory,
            TeamCluster,
            CatalogFolder,
            Team,
            User
        ]);

        socketIOEventRegistry.on = ((_socketId: string, event: string, handler: SocketEventHandler<never, unknown>) => {
            handlers.set(event, handler);
        }) as typeof socketIOEventRegistry.on;
        socketIORoomManager.join = (async (socketId: string, room: string) => {
            joinedRooms.push({
                socketId,
                room
            });
        }) as typeof socketIORoomManager.join;
        socketIORoomManager.leave = (async (socketId: string, room: string) => {
            leftRooms.push({
                socketId,
                room
            });
        }) as typeof socketIORoomManager.leave;
        socketIOEmitter.emitToSocket = ((socketId: string, event: string, data: unknown) => {
            emitted.push({
                socketId,
                event,
                data
            });
        }) as typeof socketIOEmitter.emitToSocket;
        analysisExecutionLogService.getFrameLog = (async (input: Record<string, unknown>) => {
            frameLogCalls.push(input);
            return frameLogReply;
        }) as unknown as typeof analysisExecutionLogService.getFrameLog;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        handlers.clear();
        emitted.length = 0;
        joinedRooms.length = 0;
        leftRooms.length = 0;
        frameLogCalls.length = 0;
        frameLogReply = {
            analysisId: 'analysis',
            timestep: 0,
            segments: [],
            sealed: false,
            truncated: false
        };
    });

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name,
            owner: owner.id
        }).save();
        const cluster = await TeamCluster.create({
            name: `cluster-${name}`,
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();
        const trajectory = await Trajectory.create({
            name: `traj-${name}`,
            team: team.id,
            createdBy: owner.id,
            storageClusterId: cluster.id,
            folder: null
        }).save();
        const plugin = await Plugin.create({
            team: team.id,
            workflow: {
                nodes: [],
                edges: []
            }
        }).save();

        return {
            team,
            owner,
            cluster,
            trajectory,
            plugin
        };
    };

    const seedAnalysis = (fixture: TeamFixture): Promise<Analysis> => Analysis.create({
        team: fixture.team.id,
        trajectory: fixture.trajectory.id,
        plugin: fixture.plugin.id,
        pluginDisplayName: 'Radial Distribution',
        config: {},
        createdBy: fixture.owner.id,
        computeClusterId: fixture.cluster.id,
        storageClusterId: fixture.cluster.id
    }).save();

    const connect = (user: User | null, currentTeamId?: string): ISocketConnection => {
        const connection = {
            id: SOCKET_ID,
            userId: user?.id,
            user: user ? { _id: user.id } : undefined,
            data: currentTeamId ? { currentTeamId } : {},
            rooms: new Set<string>()
        } as ISocketConnection;

        socketModule.onConnection(connection);

        return connection;
    };

    const subscribe = async (connection: ISocketConnection, payload: Record<string, unknown>): Promise<void> => {
        const handler = handlers.get(ANALYSIS_LOG_SOCKET_EVENTS.SUBSCRIBE);
        assert.ok(handler);
        await handler(connection, payload as never);
    };

    it('registers no handler for an unauthenticated connection', () => {
        connect(null);

        assert.equal(handlers.size, 0);
    });

    it('rejects a subscription when the socket has no team selected', async () => {
        const fixture = await createTeamFixture('one');
        const analysis = await seedAnalysis(fixture);
        const connection = connect(fixture.owner);

        await subscribe(connection, {
            analysisId: analysis.id,
            timestep: 0
        });

        assert.deepEqual(emitted, [{
            socketId: SOCKET_ID,
            event: 'error',
            data: {
                code: ErrorCodes.TEAM_ID_REQUIRED,
                details: 'No team selected'
            }
        }]);
        assert.deepEqual(joinedRooms, []);
    });

    it('rejects a subscription to an analysis that does not exist', async () => {
        const fixture = await createTeamFixture('one');
        const connection = connect(fixture.owner, fixture.team.id);

        await subscribe(connection, {
            analysisId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
            timestep: 0
        });

        assert.deepEqual(emitted, [{
            socketId: SOCKET_ID,
            event: 'error',
            data: {
                code: ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                details: 'You are not allowed to subscribe to this analysis log'
            }
        }]);
        assert.deepEqual(joinedRooms, []);
    });

    it('rejects a subscription with a malformed analysis id instead of failing', async () => {
        const fixture = await createTeamFixture('one');
        const connection = connect(fixture.owner, fixture.team.id);

        await subscribe(connection, {
            analysisId: 'not-an-id',
            timestep: 0
        });

        assert.equal(emitted.length, 1);
        assert.deepEqual(emitted[0].data, {
            code: ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
            details: 'You are not allowed to subscribe to this analysis log'
        });
    });

    it('rejects a subscription to an analysis of another team', async () => {
        const fixture = await createTeamFixture('one');
        const otherFixture = await createTeamFixture('two');
        const analysis = await seedAnalysis(fixture);
        const connection = connect(otherFixture.owner, otherFixture.team.id);

        await subscribe(connection, {
            analysisId: analysis.id,
            timestep: 0
        });

        assert.deepEqual(emitted, [{
            socketId: SOCKET_ID,
            event: 'error',
            data: {
                code: ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                details: 'You are not allowed to subscribe to this analysis log'
            }
        }]);
        assert.deepEqual(joinedRooms, []);
    });

    it('joins the log room of the analysis and the timestep', async () => {
        const fixture = await createTeamFixture('one');
        const analysis = await seedAnalysis(fixture);
        const connection = connect(fixture.owner, fixture.team.id);

        await subscribe(connection, {
            analysisId: analysis.id,
            timestep: 7
        });

        assert.deepEqual(joinedRooms, [{
            socketId: SOCKET_ID,
            room: `analysis-log:${analysis.id}:7`
        }]);
        assert.deepEqual(emitted, []);
    });

    it('skips the replay when no cursor is given', async () => {
        const fixture = await createTeamFixture('one');
        const analysis = await seedAnalysis(fixture);
        const connection = connect(fixture.owner, fixture.team.id);

        await subscribe(connection, {
            analysisId: analysis.id,
            timestep: 0
        });

        assert.deepEqual(frameLogCalls, []);
    });

    it('replays from the cursor using the trajectory of the stored analysis', async () => {
        const fixture = await createTeamFixture('one');
        const analysis = await seedAnalysis(fixture);
        const connection = connect(fixture.owner, fixture.team.id);

        frameLogReply = {
            analysisId: analysis.id,
            timestep: 3,
            segments: [{ text: 'hello' }],
            sealed: false,
            truncated: false,
            nextCursor: 'cursor-2'
        };

        await subscribe(connection, {
            analysisId: analysis.id,
            timestep: 3,
            afterCursor: 'cursor-1'
        });

        assert.deepEqual(frameLogCalls, [{
            analysisId: analysis.id,
            teamId: fixture.team.id,
            trajectoryId: fixture.trajectory.id,
            timestep: 3,
            afterCursor: 'cursor-1'
        }]);
        assert.deepEqual(emitted, [{
            socketId: SOCKET_ID,
            event: ANALYSIS_LOG_SOCKET_EVENTS.CHUNK,
            data: {
                analysisId: analysis.id,
                timestep: 3,
                cursor: 'cursor-2',
                segments: [{ text: 'hello' }],
                sealed: false,
                status: undefined,
                truncated: false
            }
        }]);
    });

    it('stays quiet when the replay has neither segments nor a seal', async () => {
        const fixture = await createTeamFixture('one');
        const analysis = await seedAnalysis(fixture);
        const connection = connect(fixture.owner, fixture.team.id);

        frameLogReply = {
            analysisId: analysis.id,
            timestep: 3,
            segments: [],
            sealed: false,
            truncated: false
        };

        await subscribe(connection, {
            analysisId: analysis.id,
            timestep: 3,
            afterCursor: 'cursor-1'
        });

        assert.deepEqual(emitted, []);
    });

    it('emits the sealed replay even when it carries no segments', async () => {
        const fixture = await createTeamFixture('one');
        const analysis = await seedAnalysis(fixture);
        const connection = connect(fixture.owner, fixture.team.id);

        frameLogReply = {
            analysisId: analysis.id,
            timestep: 3,
            segments: [],
            sealed: true,
            truncated: false,
            status: 'completed'
        };

        await subscribe(connection, {
            analysisId: analysis.id,
            timestep: 3,
            afterCursor: 'cursor-1'
        });

        assert.equal(emitted.length, 1);
        assert.equal(emitted[0].event, ANALYSIS_LOG_SOCKET_EVENTS.CHUNK);
    });

    it('leaves the log room without checking the analysis on unsubscribe', async () => {
        const fixture = await createTeamFixture('one');
        const connection = connect(fixture.owner, fixture.team.id);
        const handler = handlers.get(ANALYSIS_LOG_SOCKET_EVENTS.UNSUBSCRIBE);

        assert.ok(handler);
        await handler(connection, {
            analysisId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
            timestep: 2
        } as never);

        assert.deepEqual(leftRooms, [{
            socketId: SOCKET_ID,
            room: 'analysis-log:a1b2c3d4e5f6a1b2c3d4e5f6:2'
        }]);
    });
});
