import { IUserRepository } from '../../../../domain/ports/IUserRepository';
import User, { UserProps } from '../../../../domain/entities/User';
import UserModel, { UserDocument } from '../models/UserModel';
import userMapper from '../mappers/UserMapper';
import { injectable, inject } from 'tsyringe';
import { MongooseBaseRepository } from '@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import UserDeletedEvent from '../../../../domain/events/UserDeletedEvent';

@injectable()
export default class UserRepository
    extends MongooseBaseRepository<User, UserProps, UserDocument>
    implements IUserRepository {

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {
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

    async findByIdWithPassword(id: string): Promise<(User & { password: string; }) | null> {
        const doc = await UserModel.findById(id).select('+password');
        return doc ? userMapper.toDomainWithPassword(doc) : null;
    }

    async removeTeamFromUser(userId: string, teamId: string): Promise<void> {
        await this.model.findByIdAndUpdate(userId, {
            $pull: {
                teams: teamId
            }
        });
    }

    async emailExists(email: string): Promise<boolean> {
        return await this.exists({ email: email.toLowerCase() });
    }

    async updatePassword(id: string, hashedPassword: string): Promise<void> {
        await UserModel.findByIdAndUpdate(id, {
            password: hashedPassword,
            passwordChangedAt: new Date(Date.now() - 1000)
        });
    }

    async updateLastLogin(id: string): Promise<void> {
        await this.updateById(id, {
            lastLoginAt: new Date()
        });
    }

    async updateAvatar(id: string, avatarUrl: string): Promise<void> {
        await this.updateById(id, { avatar: avatarUrl });
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);

        if (result) {
            await this.eventBus.publish(new UserDeletedEvent({
                userId: id
            }));
        }

        return !!result;
    }
};