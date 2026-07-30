import { Column, Entity, Index } from 'typeorm';
import BaseModel from '@shared/infrastructure/persistence/BaseModel';
import { Hidden } from '@shared/infrastructure/persistence/Hidden';
import { OAuthProvider, UserRole } from '@modules/auth/contracts/user';

@Entity('users')
@Index(['oauthProvider', 'oauthId'], {
    unique: true,
    where: '"oauthProvider" IS NOT NULL'
})
export default class User extends BaseModel{
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

    @Column({
        type: 'simple-enum',
        enum: UserRole,
        default: UserRole.User
    })
    role!: UserRole;

    @Column({
        type: Date,
        nullable: true
    })
    passwordChangedAt!: Date | null;

    @Column({
        type: Date,
        default: () => 'CURRENT_TIMESTAMP'
    })
    lastLoginAt!: Date;

    @Column({
        type: Date,
        default: () => 'CURRENT_TIMESTAMP'
    })
    lastSeenAt!: Date;

    @Column('varchar')
    firstName!: string;

    @Column({
        type: 'varchar',
        default: ''
    })
    lastName!: string;

    @Column({
        type: 'simple-array',
        nullable: true
    })
    teams!: string[] | null;

    @Column({
        type: 'simple-array',
        nullable: true
    })
    analyses!: string[] | null;

    @Column({
        type: 'simple-enum',
        enum: OAuthProvider,
        nullable: true
    })
    oauthProvider!: OAuthProvider | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    oauthId!: string | null;

    @Column({
        type: 'varchar',
        nullable: true
    })
    avatar!: string | null;

    isPasswordChangedAfterTokenIssued(jwtTimestamp: number): boolean{
        if(!this.passwordChangedAt) return false;
        return Math.floor(this.passwordChangedAt.getTime() / 1000) > jwtTimestamp;
    }
}
