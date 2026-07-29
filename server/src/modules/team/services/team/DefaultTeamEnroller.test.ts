import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import DefaultTeamEnroller from '@modules/team/services/team/DefaultTeamEnroller';
import DeploymentSettings from '@modules/system/models/DeploymentSettings';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import { SystemRoleNames } from '@core/constants/system-roles';

interface Fixture{
    owner: User;
    team: Team;
    memberRole: TeamRole;
}

describe('DefaultTeamEnroller', () => {
    let dataSource: DataSource;
    const enroller = new DefaultTeamEnroller();

    before(async () => {
        dataSource = await createHarness([
            DeploymentSettings,
            Team,
            TeamMember,
            TeamRole,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createUser = (email: string): Promise<User> => User.create({
        email,
        firstName: 'ada'
    }).save();

    const createFixture = async (): Promise<Fixture> => {
        const owner = await createUser('owner@volt.test');
        const team = await Team.create({
            name: 'Default Team',
            owner: owner.id
        }).save();
        const memberRole = await TeamRole.create({
            team: team.id,
            name: SystemRoleNames.MEMBER,
            permissions: ['team:read'],
            isSystem: true
        }).save();

        return {
            owner,
            team,
            memberRole
        };
    };

    const configureDeployment = (defaultTeam: string | null, autoJoinNewMembers: boolean): Promise<DeploymentSettings> => DeploymentSettings.create({
        key: 'singleton',
        defaultTeam,
        autoJoinNewMembers
    }).save();

    it('enrols the user into the configured default team as a Member', async () => {
        const fixture = await createFixture();
        await configureDeployment(fixture.team.id, true);
        const joiner = await createUser('joiner@volt.test');

        await enroller.enrollIfConfigured(joiner.id);

        const membership = await TeamMember.findOneByOrFail({
            team: fixture.team.id,
            user: joiner.id
        });
        assert.equal(membership.role, fixture.memberRole.id);
        assert.deepEqual((await User.findOneByOrFail({ id: joiner.id })).teams, [fixture.team.id]);
    });

    it('skips the enrolment when the auto join is disabled', async () => {
        const fixture = await createFixture();
        await configureDeployment(fixture.team.id, false);
        const joiner = await createUser('joiner@volt.test');

        await enroller.enrollIfConfigured(joiner.id);

        assert.equal(await TeamMember.countBy({ user: joiner.id }), 0);
    });

    it('skips the enrolment when no default team is configured', async () => {
        await createFixture();
        await configureDeployment(null, true);
        const joiner = await createUser('joiner@volt.test');

        await enroller.enrollIfConfigured(joiner.id);

        assert.equal(await TeamMember.countBy({ user: joiner.id }), 0);
    });

    it('skips the enrolment when the deployment has no settings row', async () => {
        await createFixture();
        const joiner = await createUser('joiner@volt.test');

        await enroller.enrollIfConfigured(joiner.id);

        assert.equal(await TeamMember.countBy({ user: joiner.id }), 0);
    });

    it('skips the enrolment when the configured default team no longer exists', async () => {
        const fixture = await createFixture();
        await configureDeployment(fixture.team.id, true);
        await Team.delete({ id: fixture.team.id });
        const joiner = await createUser('joiner@volt.test');

        await enroller.enrollIfConfigured(joiner.id);

        assert.equal(await TeamMember.countBy({ user: joiner.id }), 0);
    });

    it('does not duplicate the membership of a user already in the default team', async () => {
        const fixture = await createFixture();
        await configureDeployment(fixture.team.id, true);
        const joiner = await createUser('joiner@volt.test');
        await enroller.enrollIfConfigured(joiner.id);

        await enroller.enrollIfConfigured(joiner.id);

        assert.equal(await TeamMember.countBy({
            team: fixture.team.id,
            user: joiner.id
        }), 1);
    });

    it('fails when the default team has no Member role', async () => {
        const fixture = await createFixture();
        await TeamRole.delete({ id: fixture.memberRole.id });
        await configureDeployment(fixture.team.id, true);
        const joiner = await createUser('joiner@volt.test');

        await assert.rejects(() => enroller.enrollIfConfigured(joiner.id));
    });
});
