import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import DailyActivity from '@modules/daily-activity/models/DailyActivity';
import DailyActivityService from '@modules/daily-activity/services/DailyActivityService';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { ActivityType } from '@volt/contracts/modules/daily-activity/domain';
import type { DailyActivityUserSummary } from '@volt/contracts/modules/daily-activity/domain';

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

describe('DailyActivityService', () => {
    let dataSource: DataSource;
    const service = new DailyActivityService();

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
        firstName: 'ada',
        lastName: 'lovelace'
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

    const seedRow = (fixture: TeamFixture, userId: string | null, date: Date, minutesOnline = 0): Promise<DailyActivity> => DailyActivity.create({
        team: fixture.team.id,
        user: userId,
        date,
        activity: [],
        minutesOnline
    }).save();

    describe('recordActivity', () => {
        it('creates the row of the day with the first entry', async () => {
            const fixture = await createTeamFixture('one');

            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'Uploaded trajectory "run"');

            const row = await DailyActivity.findOneByOrFail({
                team: fixture.team.id,
                user: fixture.owner.id
            });

            assert.equal(row.activity.length, 1);
            assert.equal(row.activity[0].type, ActivityType.TrajectoryUpload);
            assert.equal(row.activity[0].description, 'Uploaded trajectory "run"');
            assert.equal(row.minutesOnline, 0);
        });

        it('appends the next entry to the existing row of the day instead of inserting another one', async () => {
            const fixture = await createTeamFixture('one');

            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'first');
            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryDeletion, 'second');

            const rows = await DailyActivity.findBy({ team: fixture.team.id });

            assert.equal(rows.length, 1);
            assert.deepEqual(rows[0].activity.map((entry) => entry.description), ['first', 'second']);
            assert.deepEqual(rows[0].activity.map((entry) => entry.type), [
                ActivityType.TrajectoryUpload,
                ActivityType.TrajectoryDeletion
            ]);
        });

        it('keeps the minutes already accumulated on the row it appends to', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, fixture.owner.id, midnight(), 42);

            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.RoleCreation, 'created role');

            const row = await DailyActivity.findOneByOrFail({
                team: fixture.team.id,
                user: fixture.owner.id
            });

            assert.equal(row.minutesOnline, 42);
            assert.equal(row.activity.length, 1);
        });

        it('opens a separate row for each user of the same team and day', async () => {
            const fixture = await createTeamFixture('one');
            const second = await createUser('second@volt.test');

            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'mine');
            await service.recordActivity(fixture.team.id, second.id, ActivityType.TrajectoryUpload, 'theirs');

            const rows = await DailyActivity.findBy({ team: fixture.team.id });

            assert.equal(rows.length, 2);
            assert.deepEqual(
                rows.map((row) => row.activity.map((entry) => entry.description)).flat().sort(),
                ['mine', 'theirs']
            );
        });

        it('opens a new row for today instead of appending to the row of a previous day', async () => {
            const fixture = await createTeamFixture('one');
            const yesterday = await seedRow(fixture, fixture.owner.id, midnight(-1));

            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'today');

            const rows = await DailyActivity.findBy({
                team: fixture.team.id,
                user: fixture.owner.id
            });

            assert.equal(rows.length, 2);
            assert.deepEqual((await DailyActivity.findOneByOrFail({ id: yesterday.id })).activity, []);
        });

        it('opens a separate row for each team of the same user and day', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');

            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'first team');
            await service.recordActivity(other.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'second team');

            assert.equal(await DailyActivity.countBy({ user: fixture.owner.id }), 2);
        });

        it('round trips the appended entries through the json column', async () => {
            const fixture = await createTeamFixture('one');

            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.SecretKeyCreation, 'created "a key" with quotes, commas');
            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.SecretKeyDeletion, 'deleted it');

            const { records } = await service.getTeamActivitySummary({ teamId: fixture.team.id });

            assert.equal(records[0].activity.length, 2);
            assert.equal(records[0].activity[0].description, 'created "a key" with quotes, commas');
            assert.ok(records[0].activity[0].createdAt instanceof Date);
            assert.ok(records[0].activity[1].createdAt instanceof Date);
        });

        it('keeps a single entry out of three concurrent appends because the read modify write loses the others', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, fixture.owner.id, midnight());

            await Promise.all([
                service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'first'),
                service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'second'),
                service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'third')
            ]);

            const row = await DailyActivity.findOneByOrFail({
                team: fixture.team.id,
                user: fixture.owner.id
            });

            assert.equal(row.activity.length, 1);
            assert.ok(['first', 'second', 'third'].includes(row.activity[0].description));
        });

        it('rejects the loser of two concurrent first entries of the day instead of merging them', async () => {
            const fixture = await createTeamFixture('one');

            const results = await Promise.allSettled([
                service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'first'),
                service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'second')
            ]);

            assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
            assert.equal(await DailyActivity.countBy({
                team: fixture.team.id,
                user: fixture.owner.id
            }), 1);
        });
    });

    describe('recordOnlineMinutes', () => {
        it('creates the row of the day with the reported minutes', async () => {
            const fixture = await createTeamFixture('one');

            await service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 5);

            const row = await DailyActivity.findOneByOrFail({
                team: fixture.team.id,
                user: fixture.owner.id
            });

            assert.equal(row.minutesOnline, 5);
            assert.deepEqual(row.activity, []);
        });

        it('accumulates the minutes on the row of the day', async () => {
            const fixture = await createTeamFixture('one');

            await service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 5);
            await service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 7);

            const rows = await DailyActivity.findBy({ team: fixture.team.id });

            assert.equal(rows.length, 1);
            assert.equal(rows[0].minutesOnline, 12);
        });

        it('accumulates every minute of a batch of concurrent reports', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, fixture.owner.id, midnight(), 0);

            await Promise.all([
                service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 1),
                service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 2),
                service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 3)
            ]);

            const row = await DailyActivity.findOneByOrFail({
                team: fixture.team.id,
                user: fixture.owner.id
            });

            assert.equal(row.minutesOnline, 6);
        });

        it('leaves the row of the same user in another team untouched', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            const foreignRow = await seedRow(other, fixture.owner.id, midnight(), 3);

            await service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 5);

            assert.equal((await DailyActivity.findOneByOrFail({ id: foreignRow.id })).minutesOnline, 3);
            assert.equal((await DailyActivity.findOneByOrFail({
                team: fixture.team.id,
                user: fixture.owner.id
            })).minutesOnline, 5);
        });

        it('leaves the row of another user of the same team untouched', async () => {
            const fixture = await createTeamFixture('one');
            const second = await createUser('second@volt.test');
            const otherRow = await seedRow(fixture, second.id, midnight(), 3);

            await service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 5);

            assert.equal((await DailyActivity.findOneByOrFail({ id: otherRow.id })).minutesOnline, 3);
        });

        it('leaves the row of a previous day untouched', async () => {
            const fixture = await createTeamFixture('one');
            const yesterday = await seedRow(fixture, fixture.owner.id, midnight(-1), 3);

            await service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 5);

            assert.equal((await DailyActivity.findOneByOrFail({ id: yesterday.id })).minutesOnline, 3);
            assert.equal(await DailyActivity.countBy({ team: fixture.team.id }), 2);
        });

        it('keeps the recorded activity of the row it increments', async () => {
            const fixture = await createTeamFixture('one');
            await service.recordActivity(fixture.team.id, fixture.owner.id, ActivityType.TrajectoryUpload, 'uploaded');

            await service.recordOnlineMinutes(fixture.team.id, fixture.owner.id, 5);

            const row = await DailyActivity.findOneByOrFail({
                team: fixture.team.id,
                user: fixture.owner.id
            });

            assert.equal(row.minutesOnline, 5);
            assert.deepEqual(row.activity.map((entry) => entry.description), ['uploaded']);
        });
    });

    describe('unique team, user and date index', () => {
        it('rejects a second row for the same team, user and day', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, fixture.owner.id, midnight());

            await assert.rejects(() => seedRow(fixture, fixture.owner.id, midnight()));
        });

        it('admits several rows without a user for the same team and day because null does not collide in sql', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, null, midnight());
            await seedRow(fixture, null, midnight());

            assert.equal(await DailyActivity.countBy({ team: fixture.team.id }), 2);
        });

        it('detaches the row instead of deleting it when the user is removed', async () => {
            const fixture = await createTeamFixture('one');
            const member = await createUser('member@volt.test');
            const row = await seedRow(fixture, member.id, midnight(), 9);

            await User.delete({ id: member.id });

            const orphan = await DailyActivity.findOneByOrFail({ id: row.id });

            assert.equal(orphan.user, null);
            assert.equal(orphan.minutesOnline, 9);
        });

        it('deletes the rows of a team when the team row is deleted', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, fixture.owner.id, midnight());

            await Team.delete({ id: fixture.team.id });

            assert.equal(await DailyActivity.count(), 0);
        });
    });

    describe('getTeamActivitySummary', () => {
        it('returns the rows of the team ordered by date ascending', async () => {
            const fixture = await createTeamFixture('one');
            const older = await seedRow(fixture, fixture.owner.id, midnight(-3));
            const newer = await seedRow(fixture, fixture.owner.id, midnight());
            const middle = await seedRow(fixture, fixture.owner.id, midnight(-1));

            const { records } = await service.getTeamActivitySummary({ teamId: fixture.team.id });

            assert.deepEqual(records.map((record) => record._id), [older.id, middle.id, newer.id]);
        });

        it('defaults the range to seven days', async () => {
            const fixture = await createTeamFixture('one');

            const { range } = await service.getTeamActivitySummary({ teamId: fixture.team.id });

            assert.equal(range, 7);
        });

        it('excludes the rows older than the default range', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, fixture.owner.id, midnight(-30));
            const recent = await seedRow(fixture, fixture.owner.id, midnight(-1));

            const { records } = await service.getTeamActivitySummary({ teamId: fixture.team.id });

            assert.deepEqual(records.map((record) => record._id), [recent.id]);
        });

        it('honours an explicit range', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, fixture.owner.id, midnight(-5));
            const inRange = await seedRow(fixture, fixture.owner.id, midnight(-1));

            const result = await service.getTeamActivitySummary({
                teamId: fixture.team.id,
                range: 2
            });

            assert.equal(result.range, 2);
            assert.deepEqual(result.records.map((record) => record._id), [inRange.id]);
        });

        it('falls back to seven days when the range is not a positive finite number', async () => {
            const fixture = await createTeamFixture('one');

            const zero = await service.getTeamActivitySummary({
                teamId: fixture.team.id,
                range: 0
            });
            const negative = await service.getTeamActivitySummary({
                teamId: fixture.team.id,
                range: -4
            });
            const infinite = await service.getTeamActivitySummary({
                teamId: fixture.team.id,
                range: Number.POSITIVE_INFINITY
            });
            const notANumber = await service.getTeamActivitySummary({
                teamId: fixture.team.id,
                range: Number.NaN
            });

            assert.equal(zero.range, 7);
            assert.equal(negative.range, 7);
            assert.equal(infinite.range, 7);
            assert.equal(notANumber.range, 7);
        });

        it('truncates a fractional range towards zero', async () => {
            const fixture = await createTeamFixture('one');

            const { range } = await service.getTeamActivitySummary({
                teamId: fixture.team.id,
                range: 3.9
            });

            assert.equal(range, 3);
        });

        it('excludes the rows of the other teams', async () => {
            const fixture = await createTeamFixture('one');
            const other = await createTeamFixture('two');
            const mine = await seedRow(fixture, fixture.owner.id, midnight());
            await seedRow(other, other.owner.id, midnight());

            const { records } = await service.getTeamActivitySummary({ teamId: fixture.team.id });

            assert.deepEqual(records.map((record) => record._id), [mine.id]);
        });

        it('narrows the summary to a single member when a user is supplied', async () => {
            const fixture = await createTeamFixture('one');
            const second = await createUser('second@volt.test');
            const mine = await seedRow(fixture, fixture.owner.id, midnight());
            await seedRow(fixture, second.id, midnight());

            const { records } = await service.getTeamActivitySummary({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(records.map((record) => record._id), [mine.id]);
        });

        it('projects the member as a summary of identifier, names and avatar', async () => {
            const fixture = await createTeamFixture('one');
            await User.update({ id: fixture.owner.id }, { avatar: 'avatar.png' });
            await seedRow(fixture, fixture.owner.id, midnight());

            const { records } = await service.getTeamActivitySummary({ teamId: fixture.team.id });
            const user = records[0].user as DailyActivityUserSummary;

            assert.deepEqual(Object.keys(user).sort(), ['_id', 'avatar', 'firstName', 'lastName']);
            assert.equal(user._id, fixture.owner.id);
            assert.equal(user.firstName, 'ada');
            assert.equal(user.lastName, 'lovelace');
            assert.equal(user.avatar, 'avatar.png');
        });

        it('leaves the avatar undefined when the member has none', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, fixture.owner.id, midnight());

            const { records } = await service.getTeamActivitySummary({ teamId: fixture.team.id });
            const user = records[0].user as DailyActivityUserSummary;

            assert.equal(user.avatar, undefined);
            assert.equal('avatar' in JSON.parse(JSON.stringify(user)), false);
        });

        it('emits the literal string null as the user of a row with no member', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, null, midnight());

            const { records } = await service.getTeamActivitySummary({ teamId: fixture.team.id });

            assert.equal(records[0].user, 'null');
        });

        it('reports the accumulated minutes and the empty activity of a fresh row', async () => {
            const fixture = await createTeamFixture('one');
            await seedRow(fixture, fixture.owner.id, midnight(), 15);

            const { records } = await service.getTeamActivitySummary({ teamId: fixture.team.id });

            assert.equal(records[0].minutesOnline, 15);
            assert.deepEqual(records[0].activity, []);
            assert.equal(records[0].team, fixture.team.id);
            assert.ok(records[0].date instanceof Date);
        });

        it('returns no record when the team has no activity', async () => {
            const fixture = await createTeamFixture('one');

            const { records } = await service.getTeamActivitySummary({ teamId: fixture.team.id });

            assert.deepEqual(records, []);
        });
    });
});
