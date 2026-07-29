import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import DeploymentSettingsService from '@modules/system/services/DeploymentSettingsService';
import DeploymentSettings from '@modules/system/models/DeploymentSettings';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

describe('DeploymentSettingsService', () => {
    let dataSource: DataSource;
    const service = new DeploymentSettingsService();

    before(async () => {
        dataSource = await createHarness([DeploymentSettings, Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const seedTeam = async (name = 'volt'): Promise<Team> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();

        return Team.create({
            name,
            owner: owner.id
        }).save();
    };

    describe('getSettings', () => {
        it('answers with empty settings while the deployment is unconfigured', async () => {
            const settings = await service.getSettings();

            assert.equal(settings._id, '');
            assert.equal(settings.props.defaultTeam, null);
            assert.equal(settings.props.autoJoinNewMembers, false);
            assert.ok(settings.props.createdAt instanceof Date);
            assert.ok(settings.props.updatedAt instanceof Date);
        });

        it('does not persist anything when it answers with empty settings', async () => {
            await service.getSettings();

            assert.equal(await DeploymentSettings.count(), 0);
        });

        it('reads back the settings that were stored', async () => {
            const team = await seedTeam();
            await service.setDefaultTeam(team.id, true);

            const settings = await service.getSettings();

            assert.equal(settings.props.defaultTeam, team.id);
            assert.equal(settings.props.autoJoinNewMembers, true);
            assert.notEqual(settings._id, '');
        });
    });

    describe('setDefaultTeam', () => {
        it('creates the singleton row on the first write', async () => {
            const team = await seedTeam();

            const settings = await service.setDefaultTeam(team.id, true);

            const stored = await DeploymentSettings.findOneByOrFail({ key: 'singleton' });
            assert.equal(settings._id, stored.id);
            assert.equal(stored.defaultTeam, team.id);
            assert.equal(stored.autoJoinNewMembers, true);
        });

        it('updates the singleton row instead of adding another one', async () => {
            const first = await seedTeam('first');
            const second = await seedTeam('second');

            const created = await service.setDefaultTeam(first.id, true);
            const updated = await service.setDefaultTeam(second.id, false);

            assert.equal(await DeploymentSettings.count(), 1);
            assert.equal(updated._id, created._id);
            assert.equal(updated.props.defaultTeam, second.id);
            assert.equal(updated.props.autoJoinNewMembers, false);
        });

        it('clears the default team', async () => {
            const team = await seedTeam();
            await service.setDefaultTeam(team.id, true);

            const settings = await service.setDefaultTeam(null, false);

            assert.equal(settings.props.defaultTeam, null);
            assert.equal((await DeploymentSettings.findOneByOrFail({ key: 'singleton' })).defaultTeam, null);
        });

        it('refuses a default team that does not exist', async () => {
            await assert.rejects(
                () => service.setDefaultTeam('missing-team', true),
                /FOREIGN KEY constraint failed/
            );
        });

        it('lets the database drop the default team when the team is deleted', async () => {
            const team = await seedTeam();
            await service.setDefaultTeam(team.id, true);

            await Team.delete({ id: team.id });

            const settings = await service.getSettings();
            assert.equal(settings.props.defaultTeam, null);
            assert.equal(settings.props.autoJoinNewMembers, true);
        });

        it('lets the database reject a second singleton row', async () => {
            const team = await seedTeam();
            await service.setDefaultTeam(team.id, true);

            await assert.rejects(() => DeploymentSettings.create({
                key: 'singleton',
                defaultTeam: null,
                autoJoinNewMembers: false
            }).save(), /UNIQUE constraint failed/);
        });
    });
});
