import { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import User, { UserProps } from '@modules/auth/domain/entities/User';
import UserModel, { UserDocument } from '@modules/auth/infrastructure/persistence/mongo/models/UserModel';
import userMapper from '@modules/auth/infrastructure/persistence/mongo/mappers/UserMapper';
import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

@injectable()
export default class UserRepository
    extends MongooseBaseRepository<User, UserProps, UserDocument>
    implements IUserRepository {

    constructor() {
        super(UserModel, userMapper);
    }

    async findByEmail(email: string): Promise<User | null> {
        const doc = await UserModel.findOne({ email: email.toLowerCase() });
        return doc ? userMapper.toDomain(doc) : null;
    }

    async findByEmailWithPassword(email: string): Promise<(User & { password: string; }) | null> {
        const doc = await UserModel.findOne({ email: email.toLowerCase() }).select('+password');
        return doc ? userMapper.toDomainWithPassword(doc) : null;
    }

    async findByIdWithPassword(userId: string): Promise<(User & { password: string; }) | null> {
        const doc = await UserModel.findById(userId).select('+password');
        return doc ? userMapper.toDomainWithPassword(doc) : null;
    }

    async removeTeamFromUser(userId: string, teamId: string): Promise<void> {
        await this.model.findByIdAndUpdate(userId, {
            $pull: {
                teams: teamId
            }
        });
    }

    async removeUsersFromTeam(teamId: string): Promise<void> {
        await this.model.updateMany(
            { teams: teamId },
            {
                $pull: {
                    teams: teamId
                }
            }
        );
    }

    async emailExists(email: string): Promise<boolean> {
        return await this.exists({ email: email.toLowerCase() });
    }

    async updatePassword(userId: string, hashedPassword: string): Promise<void> {
        await UserModel.findByIdAndUpdate(userId, {
            password: hashedPassword,
            passwordChangedAt: new Date(Date.now() - 1000)
        });
    }

    async updateLastLogin(userId: string): Promise<void> {
        const now = new Date();
        await this.updateById(userId, {
            lastLoginAt: now,
            lastSeenAt: now
        });
    }

    async updateLastSeen(userId: string, timestamp: Date = new Date()): Promise<void> {
        await this.updateById(userId, {
            lastSeenAt: timestamp
        });
    }

    async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
        await this.updateById(userId, { avatar: avatarUrl });
    }

    async deleteById(userId: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(userId);
        return !!result;
    }
};
