import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import LatexDocument from '@modules/latex/models/LatexDocument';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

@Entity('latex_assets')
@Index(['document', 'createdAt'])
@Index(['team'])
export default class LatexAsset extends BaseModel{
    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @ManyToOne(() => LatexDocument, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'document' })
    documentRef?: LatexDocument;

    @ReferenceColumn()
    document!: string;

    @Column('varchar')
    originalName!: string;

    @Column('varchar')
    path!: string;

    @Column('varchar')
    storageKey!: string;

    @Column('varchar')
    url!: string;

    @Column('varchar')
    mimetype!: string;

    @Column('integer')
    size!: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;
}
