import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { Hidden } from '@shared/infrastructure/persistence/Hidden';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import { isEntityId } from '@shared/infrastructure/persistence/entity-id';

@Entity('owners')
class Owner extends BaseModel{
    @Column({
        type: 'varchar',
        unique: true
    })
    email!: string;

    @Column({
        type: 'varchar',
        nullable: true
    })
    @Hidden()
    password!: string | null;
}

@Entity('artifacts')
class Artifact extends BaseModel{
    @ManyToOne(() => Owner, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: Owner;

    @ReferenceColumn({ nullable: true })
    createdBy!: string | null;

    @Column('varchar')
    name!: string;
}

describe('BaseModel', () => {
    let dataSource: DataSource;
    let sequence = 0;

    before(async () => {
        dataSource = await createHarness([Owner, Artifact]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    const createOwner = () => Owner.create({
        email: `owner-${++sequence}@volt.test`,
        password: 'hashed-secret'
    }).save();

    it('assigns a 24 hex character identifier on insert', async () => {
        const owner = await createOwner();

        assert.ok(isEntityId(owner.id), `expected an ObjectId shaped id, received ${owner.id}`);
    });

    it('generates distinct identifiers under concurrency', async () => {
        const owners = await Promise.all([createOwner(), createOwner(), createOwner()]);
        const ids = new Set(owners.map((owner) => owner.id));

        assert.equal(ids.size, owners.length);
    });

    it('keeps an explicitly supplied identifier instead of overwriting it', async () => {
        const owner = await Owner.create({
            id: 'a'.repeat(24),
            email: `owner-${++sequence}@volt.test`,
            password: null
        }).save();

        assert.equal(owner.id, 'a'.repeat(24));
    });

    it('serializes the identifier as _id and never leaks id', async () => {
        const owner = await createOwner();
        const payload = owner.toJSON();

        assert.equal(payload._id, owner.id);
        assert.equal('id' in payload, false);
    });

    it('omits fields marked with @Hidden', async () => {
        const owner = await createOwner();
        const payload = owner.toJSON();

        assert.equal('password' in payload, false);
        assert.equal(payload.email, owner.email);
    });

    it('exposes createdAt and updatedAt as dates', async () => {
        const owner = await createOwner();
        const payload = owner.toJSON();

        assert.ok(payload.createdAt instanceof Date);
        assert.ok(payload.updatedAt instanceof Date);
    });

    it('flattens an unloaded reference to its foreign key, preserving Ref<T>', async () => {
        const owner = await createOwner();
        await Artifact.create({
            createdBy: owner.id,
            name: 'unloaded'
        }).save();

        const artifact = await Artifact.findOneByOrFail({ name: 'unloaded' });
        const payload = artifact.toJSON();

        assert.equal(payload.createdBy, owner.id);
    });

    it('emits the related entity under the wire field when the reference is loaded', async () => {
        const owner = await createOwner();
        await Artifact.create({
            createdBy: owner.id,
            name: 'loaded'
        }).save();

        const artifact = await Artifact.findOneOrFail({
            where: { name: 'loaded' },
            relations: { createdByRef: true }
        });
        const payload = artifact.toJSON();

        assert.equal((payload.createdBy as Owner).id, owner.id);
        assert.equal('createdByRef' in payload, false);
    });

    it('keeps a nullable reference null instead of inventing a foreign key', async () => {
        await Artifact.create({
            createdBy: null,
            name: 'orphan'
        }).save();

        const artifact = await Artifact.findOneByOrFail({ name: 'orphan' });
        const payload = artifact.toJSON();

        assert.equal(payload.createdBy, null);
    });

    it('nests the wire shape when a loaded reference is stringified', async () => {
        const owner = await createOwner();
        await Artifact.create({
            createdBy: owner.id,
            name: 'nested'
        }).save();

        const artifact = await Artifact.findOneOrFail({
            where: { name: 'nested' },
            relations: { createdByRef: true }
        });
        const wire = JSON.parse(JSON.stringify(artifact)) as { createdBy: Record<string, unknown> };

        assert.equal(wire.createdBy._id, owner.id);
        assert.equal('password' in wire.createdBy, false);
    });
});
