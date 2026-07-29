import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import Notification from '@modules/notification/models/Notification';
import NotificationService from '@modules/notification/services/NotificationService';
import User from '@modules/auth/models/User';

describe('NotificationService', () => {
    let dataSource: DataSource;
    const service = new NotificationService();

    before(async () => {
        dataSource = await createHarness([Notification, User]);
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

    const pinCreatedAt = (notificationId: string, value: string): Promise<unknown> => Notification.getRepository().query(
        'UPDATE notifications SET "createdAt" = ?, "updatedAt" = ? WHERE id = ?',
        [value, value, notificationId]
    );

    const seedNotifications = async (recipient: string, titles: string[]): Promise<void> => {
        for(const [index, title] of titles.entries()){
            const created = await service.create({
                recipient,
                title,
                content: `content of ${title}`
            });
            await pinCreatedAt(created._id, `2024-01-0${index + 1} 00:00:00.000`);
        }
    };

    describe('create', () => {
        it('persists the notification as unread and returns its wire shape', async () => {
            const user = await createUser('created@volt.test');

            const notification = await service.create({
                recipient: user.id,
                title: 'Team Invitation',
                content: 'You have been invited'
            });

            assert.equal(notification.recipient, user.id);
            assert.equal(notification.title, 'Team Invitation');
            assert.equal(notification.content, 'You have been invited');
            assert.equal(notification.read, false);
            assert.ok(notification.createdAt instanceof Date);
            assert.ok(notification.updatedAt instanceof Date);
            assert.equal(await Notification.countBy({ id: notification._id }), 1);
        });

        it('returns the identifier as _id', async () => {
            const user = await createUser('identified@volt.test');

            const notification = await service.create({
                recipient: user.id,
                title: 'Title',
                content: 'Content'
            });
            const stored = await Notification.findOneByOrFail({ id: notification._id });

            assert.equal(notification._id, stored.id);
        });

        it('keeps the supplied link on the wire', async () => {
            const user = await createUser('linked@volt.test');

            const notification = await service.create({
                recipient: user.id,
                title: 'Team Invitation',
                content: 'You have been invited',
                link: '/team-invitation/abc'
            });

            assert.equal(notification.link, '/team-invitation/abc');
            assert.equal(JSON.parse(JSON.stringify(notification)).link, '/team-invitation/abc');
        });

        it('omits the link from the json instead of emitting null when none is supplied', async () => {
            const user = await createUser('linkless@volt.test');

            const notification = await service.create({
                recipient: user.id,
                title: 'Welcome',
                content: 'Content'
            });
            const wire = JSON.parse(JSON.stringify(notification)) as Record<string, unknown>;

            assert.equal('link' in wire, false);
            assert.equal(notification.link, undefined);
            assert.equal((await Notification.findOneByOrFail({ id: notification._id })).link, null);
        });

        it('omits the link from the json of a notification read back from the database', async () => {
            const user = await createUser('reread@volt.test');
            const created = await service.create({
                recipient: user.id,
                title: 'Welcome',
                content: 'Content'
            });

            const { data } = await service.getMyNotifications({ userId: user.id });
            const wire = JSON.parse(JSON.stringify(data[0])) as Record<string, unknown>;

            assert.equal(wire._id, created._id);
            assert.equal('link' in wire, false);
        });
    });

    describe('getMyNotifications', () => {
        it('returns the notifications of the recipient newest first', async () => {
            const user = await createUser('listed@volt.test');
            await seedNotifications(user.id, ['first', 'second', 'third']);

            const result = await service.getMyNotifications({ userId: user.id });

            assert.deepEqual(result.data.map((notification) => notification.title), ['third', 'second', 'first']);
        });

        it('excludes the notifications addressed to another user', async () => {
            const user = await createUser('mine@volt.test');
            const other = await createUser('theirs@volt.test');
            await seedNotifications(user.id, ['mine']);
            await seedNotifications(other.id, ['theirs']);

            const result = await service.getMyNotifications({ userId: user.id });

            assert.deepEqual(result.data.map((notification) => notification.title), ['mine']);
            assert.equal(result.total, 1);
        });

        it('defaults to page one with a limit of one hundred', async () => {
            const user = await createUser('defaults@volt.test');
            await seedNotifications(user.id, ['only']);

            const result = await service.getMyNotifications({ userId: user.id });

            assert.equal(result.page, 1);
            assert.equal(result.limit, 100);
            assert.equal(result.total, 1);
            assert.equal(result.totalPages, 1);
        });

        it('slices the requested page and reports the page count', async () => {
            const user = await createUser('paged@volt.test');
            await seedNotifications(user.id, ['first', 'second', 'third']);

            const result = await service.getMyNotifications({
                userId: user.id,
                page: 2,
                limit: 2
            });

            assert.deepEqual(result.data.map((notification) => notification.title), ['first']);
            assert.equal(result.page, 2);
            assert.equal(result.limit, 2);
            assert.equal(result.total, 3);
            assert.equal(result.totalPages, 2);
        });

        it('returns an empty page past the end of the collection', async () => {
            const user = await createUser('overshoot@volt.test');
            await seedNotifications(user.id, ['only']);

            const result = await service.getMyNotifications({
                userId: user.id,
                page: 9,
                limit: 10
            });

            assert.deepEqual(result.data, []);
            assert.equal(result.total, 1);
        });

        it('caps the requested limit at five hundred', async () => {
            const user = await createUser('capped@volt.test');
            await seedNotifications(user.id, ['only']);

            const result = await service.getMyNotifications({
                userId: user.id,
                limit: 100000
            });

            assert.equal(result.limit, 500);
        });

        it('falls back to the default limit when the requested limit is not an integer', async () => {
            const user = await createUser('fractional-limit@volt.test');
            await seedNotifications(user.id, ['only']);

            const result = await service.getMyNotifications({
                userId: user.id,
                limit: 2.5
            });

            assert.equal(result.limit, 100);
        });

        it('falls back to the default limit when the requested limit is zero or negative', async () => {
            const user = await createUser('nonpositive-limit@volt.test');
            await seedNotifications(user.id, ['only']);

            const zero = await service.getMyNotifications({
                userId: user.id,
                limit: 0
            });
            const negative = await service.getMyNotifications({
                userId: user.id,
                limit: -10
            });

            assert.equal(zero.limit, 100);
            assert.equal(negative.limit, 100);
        });

        it('falls back to the first page when the requested page is not a positive integer', async () => {
            const user = await createUser('fractional-page@volt.test');
            await seedNotifications(user.id, ['first', 'second']);

            const fractional = await service.getMyNotifications({
                userId: user.id,
                page: 1.5,
                limit: 1
            });
            const negative = await service.getMyNotifications({
                userId: user.id,
                page: -2,
                limit: 1
            });

            assert.equal(fractional.page, 1);
            assert.equal(negative.page, 1);
            assert.deepEqual(fractional.data.map((notification) => notification.title), ['second']);
        });

        it('reports zero pages when the recipient has no notification', async () => {
            const user = await createUser('empty@volt.test');

            const result = await service.getMyNotifications({ userId: user.id });

            assert.deepEqual(result.data, []);
            assert.equal(result.total, 0);
            assert.equal(result.totalPages, 0);
        });
    });

    describe('markAllAsRead', () => {
        it('marks every unread notification of the user as read', async () => {
            const user = await createUser('unread@volt.test');
            await seedNotifications(user.id, ['first', 'second']);

            await service.markAllAsRead(user.id);

            assert.equal(await Notification.countBy({
                recipient: user.id,
                read: false
            }), 0);
            assert.equal(await Notification.countBy({
                recipient: user.id,
                read: true
            }), 2);
        });

        it('leaves the notifications of the other users unread', async () => {
            const user = await createUser('mine@volt.test');
            const other = await createUser('theirs@volt.test');
            await seedNotifications(user.id, ['mine']);
            await seedNotifications(other.id, ['theirs']);

            await service.markAllAsRead(user.id);

            assert.equal(await Notification.countBy({
                recipient: other.id,
                read: false
            }), 1);
        });

        it('resolves when the user has nothing unread', async () => {
            const user = await createUser('all-read@volt.test');
            await seedNotifications(user.id, ['only']);
            await service.markAllAsRead(user.id);

            await service.markAllAsRead(user.id);

            assert.equal(await Notification.countBy({
                recipient: user.id,
                read: true
            }), 1);
        });
    });
});
