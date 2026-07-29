import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import Notification from '@modules/notification/models/Notification';
import NotificationEvents from '@modules/notification/events/NotificationEvents';
import DeploymentSettings from '@modules/system/models/DeploymentSettings';
import DeploymentSettingsService from '@modules/system/services/DeploymentSettingsService';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

describe('NotificationEvents', () => {
    let dataSource: DataSource;
    const events = new NotificationEvents();
    const deploymentSettings = new DeploymentSettingsService();

    before(async () => {
        dataSource = await createHarness([Notification, DeploymentSettings, Team, User]);
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

    const createTeam = async (name: string): Promise<Team> => {
        const owner = await createUser(`owner-${name}@volt.test`);
        return Team.create({
            name,
            owner: owner.id
        }).save();
    };

    describe('notifyInvitedUser', () => {
        it('notifies the invited user with the team name and the invitation link', async () => {
            const invited = await createUser('invited@volt.test');

            await events.notifyInvitedUser({
                teamName: 'Molecular Dynamics',
                invitedUserId: invited.id,
                invitationId: 'invitation-1'
            });

            const notification = await Notification.findOneByOrFail({ recipient: invited.id });

            assert.equal(notification.title, 'Team Invitation');
            assert.equal(notification.content, 'You have been invited to join the team "Molecular Dynamics"');
            assert.equal(notification.link, '/team-invitation/invitation-1');
            assert.equal(notification.read, false);
        });
    });

    describe('welcomeUser', () => {
        it('welcomes the created user with a capitalized first name', async () => {
            const user = await createUser('welcomed@volt.test');

            await events.welcomeUser({
                id: user.id,
                firstName: 'ada'
            });

            const notification = await Notification.findOneByOrFail({
                recipient: user.id,
                title: 'Welcome to the platform!'
            });

            assert.ok(notification.content.includes('Ada'));
            assert.equal(notification.link, '/dashboard');
        });

        it('leaves an already capitalized first name untouched', async () => {
            const user = await createUser('capitalized@volt.test');

            await events.welcomeUser({
                id: user.id,
                firstName: 'Ada'
            });

            const notification = await Notification.findOneByOrFail({ recipient: user.id });

            assert.ok(notification.content.includes('Ada'));
            assert.equal(notification.content.includes('AAda'), false);
        });
    });

    describe('onboardTeam', () => {
        it('asks the user to create a team when the deployment has no default team', async () => {
            const user = await createUser('onboarded@volt.test');

            await events.onboardTeam({
                id: user.id,
                firstName: 'ada'
            });

            const notification = await Notification.findOneByOrFail({
                recipient: user.id,
                title: 'Create your first team'
            });

            assert.equal(notification.content, 'Hi ada, get started by creating your first team and connecting a cluster.');
            assert.equal(notification.link, '/onboarding');
        });

        it('asks the user to create a team when a default team exists but auto join is off', async () => {
            const user = await createUser('manual-join@volt.test');
            const team = await createTeam('shared');
            await deploymentSettings.setDefaultTeam(team.id, false);

            await events.onboardTeam({
                id: user.id,
                firstName: 'ada'
            });

            assert.equal(await Notification.countBy({
                recipient: user.id,
                title: 'Create your first team'
            }), 1);
        });

        it('skips the onboarding notification when the deployment auto joins new members into a default team', async () => {
            const user = await createUser('auto-joined@volt.test');
            const team = await createTeam('shared');
            await deploymentSettings.setDefaultTeam(team.id, true);

            await events.onboardTeam({
                id: user.id,
                firstName: 'ada'
            });

            assert.equal(await Notification.countBy({ recipient: user.id }), 0);
        });

        it('asks the user to create a team when auto join is on but no default team is configured', async () => {
            const user = await createUser('auto-join-no-team@volt.test');
            await deploymentSettings.setDefaultTeam(null, true);

            await events.onboardTeam({
                id: user.id,
                firstName: 'ada'
            });

            assert.equal(await Notification.countBy({
                recipient: user.id,
                title: 'Create your first team'
            }), 1);
        });
    });

    describe('deleteUserNotifications', () => {
        it('deletes every notification addressed to the deleted user', async () => {
            const user = await createUser('deleted@volt.test');
            await events.welcomeUser({
                id: user.id,
                firstName: 'ada'
            });
            await events.onboardTeam({
                id: user.id,
                firstName: 'ada'
            });

            await events.deleteUserNotifications({ userId: user.id });

            assert.equal(await Notification.countBy({ recipient: user.id }), 0);
        });

        it('keeps the notifications of the other users', async () => {
            const user = await createUser('deleted@volt.test');
            const survivor = await createUser('survivor@volt.test');
            await events.welcomeUser({
                id: user.id,
                firstName: 'ada'
            });
            await events.welcomeUser({
                id: survivor.id,
                firstName: 'grace'
            });

            await events.deleteUserNotifications({ userId: user.id });

            assert.equal(await Notification.countBy({ recipient: survivor.id }), 1);
        });

        it('resolves when the deleted user had no notification', async () => {
            const user = await createUser('quiet@volt.test');

            await events.deleteUserNotifications({ userId: user.id });

            assert.equal(await Notification.count(), 0);
        });

        it('lets the foreign key cascade remove the notifications when the user row is deleted', async () => {
            const user = await createUser('cascade@volt.test');
            await events.welcomeUser({
                id: user.id,
                firstName: 'ada'
            });

            await User.delete({ id: user.id });

            assert.equal(await Notification.count(), 0);
        });
    });
});
