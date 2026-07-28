import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

@Entity('latex_documents')
@Index(['team', 'folder', 'createdAt'])
export default class LatexDocument extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @Column('varchar')
    title!: string;

    @ReferenceColumn({ nullable: true })
    storageClusterId!: string | null;

    @ManyToOne(() => CatalogFolder, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'folder' })
    folderRef?: CatalogFolder;

    @ReferenceColumn({ nullable: true })
    folder!: string | null;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;

    @ManyToOne(() => User, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'lastEditedBy' })
    lastEditedByRef?: User;

    @ReferenceColumn({ nullable: true })
    lastEditedBy!: string | null;
}
