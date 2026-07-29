import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import DailyActivity from '@modules/daily-activity/models/DailyActivity';
import DailyActivityEvents from '@modules/daily-activity/events/DailyActivityEvents';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { ActivityType } from '@volt/contracts/modules/daily-activity/domain';

interface TeamFixture{
    team: Team;
    owner: User;
}

const midnight = (offsetInDays = 0): Date => {
    const date = new Date();
    date.setDate(date.getDate() + offsetInDays);
    date.setHours(0, 0, 0, 0);
    return date;
};

describe('DailyActivityEvents', () => {
    let dataSource: DataSource;
    const events = new DailyActivityEvents();

    before(async () => {
        dataSource = await createHarness([DailyActivity, Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createUser = (email: string): Promise<User> => User.create({
        email,
        firstName: 'ada'
    }).save();

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await createUser(`owner-${name}@volt.test`);
        const team = await Team.create({
            name,
            owner: owner.id
        }).save();

        return {
            team,
            owner
        };
    };

    const readEntries = async (fixture: TeamFixture): Promise<{ type: ActivityType; description: string }[]> => {
        const row = await DailyActivity.findOneByOrFail({
            team: fixture.team.id,
            user: fixture.owner.id
        });

        return row.activity.map((entry) => ({
            type: entry.type,
            description: entry.description
        }));
    };

    it('records a trajectory upload with the trajectory name', async () => {
        const fixture = await createTeamFixture('one');

        await events.trajectoryCreated({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            trajectoryName: 'run-1',
            trajectoryId: 'a'.repeat(24)
        });

        assert.deepEqual(await readEntries(fixture), [{
            type: ActivityType.TrajectoryUpload,
            description: 'Uploaded trajectory "run-1"'
        }]);
    });

    it('records a trajectory deletion with the trajectory name', async () => {
        const fixture = await createTeamFixture('one');

        await events.trajectoryDeleted({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            trajectoryId: 'a'.repeat(24),
            trajectoryName: 'run-1'
        });

        assert.deepEqual(await readEntries(fixture), [{
            type: ActivityType.TrajectoryDeletion,
            description: 'Deleted trajectory "run-1"'
        }]);
    });

    it('records an analysis deletion with the plugin display name', async () => {
        const fixture = await createTeamFixture('one');

        await events.analysisDeleted({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            analysisId: 'a'.repeat(24),
            trajectoryId: 'b'.repeat(24),
            pluginId: 'c'.repeat(24),
            pluginDisplayName: 'Radial Distribution'
        });

        assert.deepEqual(await readEntries(fixture), [{
            type: ActivityType.AnalysisDeletion,
            description: 'Deleted analysis "Radial Distribution"'
        }]);
    });

    it('accumulates the entries of several events on the row of the day', async () => {
        const fixture = await createTeamFixture('one');

        await events.teamRoleCreated({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            teamRoleId: 'a'.repeat(24),
            name: 'reviewer'
        });
        await events.teamRoleDeleted({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            teamRoleId: 'a'.repeat(24),
            roleName: 'reviewer'
        });

        assert.deepEqual(await readEntries(fixture), [
            {
                type: ActivityType.RoleCreation,
                description: 'Created role "reviewer"'
            },
            {
                type: ActivityType.RoleDeletion,
                description: 'Deleted role "reviewer"'
            }
        ]);
        assert.equal(await DailyActivity.countBy({ team: fixture.team.id }), 1);
    });

    it('adds the reported minutes to the row of the day', async () => {
        const fixture = await createTeamFixture('one');

        await events.userActivityRecorded({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            minutes: 5
        });
        await events.userActivityRecorded({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            minutes: 7
        });

        const row = await DailyActivity.findOneByOrFail({
            team: fixture.team.id,
            user: fixture.owner.id
        });

        assert.equal(row.minutesOnline, 12);
    });

    it('swallows the failure of an unrecordable minutes report', async () => {
        const fixture = await createTeamFixture('one');

        await events.userActivityRecorded({
            teamId: fixture.team.id,
            userId: 'ffffffffffffffffffffffff',
            minutes: 5
        });

        assert.equal(await DailyActivity.count(), 0);
    });

    it('deletes every row of the deleted team', async () => {
        const fixture = await createTeamFixture('one');
        const other = await createTeamFixture('two');
        await DailyActivity.create({
            team: fixture.team.id,
            user: fixture.owner.id,
            date: midnight(),
            activity: [],
            minutesOnline: 1
        }).save();
        await DailyActivity.create({
            team: fixture.team.id,
            user: fixture.owner.id,
            date: midnight(-1),
            activity: [],
            minutesOnline: 1
        }).save();
        await DailyActivity.create({
            team: other.team.id,
            user: other.owner.id,
            date: midnight(),
            activity: [],
            minutesOnline: 1
        }).save();

        await events.deleteTeamActivity({ teamId: fixture.team.id });

        assert.equal(await DailyActivity.countBy({ team: fixture.team.id }), 0);
        assert.equal(await DailyActivity.countBy({ team: other.team.id }), 1);
    });

    it('deletes the rows of the deleted user across every team', async () => {
        const fixture = await createTeamFixture('one');
        const other = await createTeamFixture('two');
        await DailyActivity.create({
            team: fixture.team.id,
            user: fixture.owner.id,
            date: midnight(),
            activity: [],
            minutesOnline: 1
        }).save();
        await DailyActivity.create({
            team: other.team.id,
            user: fixture.owner.id,
            date: midnight(),
            activity: [],
            minutesOnline: 1
        }).save();
        await DailyActivity.create({
            team: other.team.id,
            user: other.owner.id,
            date: midnight(),
            activity: [],
            minutesOnline: 1
        }).save();

        await events.deleteUserActivity({ userId: fixture.owner.id });

        assert.equal(await DailyActivity.countBy({ user: fixture.owner.id }), 0);
        assert.equal(await DailyActivity.countBy({ user: other.owner.id }), 1);
    });

    it('keeps the ownerless rows when a user is deleted', async () => {
        const fixture = await createTeamFixture('one');
        const orphan = await DailyActivity.create({
            team: fixture.team.id,
            user: null,
            date: midnight(),
            activity: [],
            minutesOnline: 1
        }).save();

        await events.deleteUserActivity({ userId: fixture.owner.id });

        assert.equal(await DailyActivity.countBy({ id: orphan.id }), 1);
    });
});
