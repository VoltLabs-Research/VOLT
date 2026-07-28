import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';

@Entity('catalog_folders')
@Index(['kind'])
@Index(['team', 'kind', 'parent', 'createdAt'])
@Index(['team', 'kind', 'title'])
export default class CatalogFolder extends BaseModel{
    @ReferenceColumn()
    team!: string;

    @ReferenceColumn()
    createdBy!: string;

    @Column('varchar')
    title!: string;

    @ManyToOne(() => CatalogFolder, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'parent' })
    parentRef?: CatalogFolder;

    @ReferenceColumn({ nullable: true })
    parent!: string | null;

    @Column({
        type: 'simple-enum',
        enum: CatalogFolderKind
    })
    kind!: CatalogFolderKind;
}
