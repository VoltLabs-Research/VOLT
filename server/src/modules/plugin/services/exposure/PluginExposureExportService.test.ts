import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import { PluginExposureExportService } from '@modules/plugin/services/exposure/PluginExposureExportService';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import type {
    IClusterObjectArchiveService,
    ITeamClusterObjectGatewayClient
} from '@shared/contracts/ports';

describe('PluginExposureExportService', () => {
    let dataSource: DataSource;
    let listedObjectNames: string[] = [];
    const archiveRequests: Array<{ teamClusterId: string; entries: unknown[] }> = [];

    const objectGatewayClient = {
        listAll: async function* () {
            for(const objectName of listedObjectNames){
                yield objectName;
            }
        }
    } as unknown as ITeamClusterObjectGatewayClient;

    const archiveService = {
        createArchiveDownload: async (input: { teamClusterId: string; entries: unknown[] }) => {
            archiveRequests.push({
                teamClusterId: input.teamClusterId,
                entries: input.entries
            });
            return {
                stream: null,
                headers: {},
                statusCode: 200
            };
        }
    } as unknown as IClusterObjectArchiveService;

    const service = new PluginExposureExportService(objectGatewayClient, archiveService);

    before(async () => {
        dataSource = await createHarness([Trajectory, TeamCluster, CatalogFolder, Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        listedObjectNames = [];
        archiveRequests.length = 0;
    });

    const createTrajectory = async (): Promise<Trajectory> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'team-one',
            owner: owner.id
        }).save();
        const cluster = await TeamCluster.create({
            name: 'cluster-one',
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();

        return Trajectory.create({
            name: 'run-one',
            team: team.id,
            storageClusterId: cluster.id,
            createdBy: owner.id
        }).save();
    };

    const expectApplicationError = async (run: () => Promise<unknown>, code: string): Promise<void> => {
        try {
            await run();
        } catch (error: unknown) {
            assert.ok(error instanceof ApplicationError);
            assert.equal(error.code, code);
            return;
        }

        throw new Error(`expected ${code} to be thrown`);
    };

    it('throws TRAJECTORY_NOT_FOUND when the trajectory does not exist', async () => {
        await expectApplicationError(
            () => service.exportAnalysisExposureBundle({
                analysisId: 'analysis-1',
                trajectoryId: 'missing',
                pluginName: 'Radial Distribution'
            }),
            ErrorCodes.TRAJECTORY_NOT_FOUND
        );
    });

    it('throws FILE_NOT_FOUND when the cluster holds no exposure file', async () => {
        const trajectory = await createTrajectory();

        await expectApplicationError(
            () => service.exportAnalysisExposureBundle({
                analysisId: 'analysis-1',
                trajectoryId: trajectory.id,
                pluginName: 'Radial Distribution'
            }),
            ErrorCodes.FILE_NOT_FOUND
        );
    });

    it('archives the exposure files against the trajectory storage cluster', async () => {
        const trajectory = await createTrajectory();
        listedObjectNames = [
            'plugins/trajectory-x/analysis-analysis-1/timestep-0.parquet',
            'plugins/trajectory-x/analysis-analysis-1/timestep-1.parquet'
        ];

        await service.exportAnalysisExposureBundle({
            analysisId: 'analysis-1',
            trajectoryId: trajectory.id,
            pluginName: 'Radial Distribution'
        });

        assert.equal(archiveRequests.length, 1);
        assert.equal(archiveRequests[0].teamClusterId, trajectory.storageClusterId);
        assert.equal(archiveRequests[0].entries.length, 2);
    });
});
