import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { ReferenceColumn } from '@shared/infrastructure/persistence/ReferenceColumn';
import LatexDocument from '@modules/latex/models/LatexDocument';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

@Entity('latex_files')
@Index(['document', 'name', 'path'], { unique: true })
@Index(['document', 'isEntrypoint'])
@Index(['document', 'createdAt'])
@Index(['team'])
export default class LatexFile extends BaseModel{
    @ManyToOne(() => LatexDocument, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'document' })
    documentRef?: LatexDocument;

    @ReferenceColumn()
    document!: string;

    @ManyToOne(() => Team, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'team' })
    teamRef?: Team;

    @ReferenceColumn()
    team!: string;

    @Column('varchar')
    name!: string;

    @Column({
        type: 'varchar',
        default: ''
    })
    path!: string;

    @Column({
        type: 'text',
        default: ''
    })
    content!: string;

    @Column({
        type: 'boolean',
        default: false
    })
    isEntrypoint!: boolean;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'createdBy' })
    createdByRef?: User;

    @ReferenceColumn()
    createdBy!: string;
}
