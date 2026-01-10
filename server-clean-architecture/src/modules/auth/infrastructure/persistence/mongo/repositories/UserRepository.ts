import { IUserRepository } from '../../../../domain/ports/IUserRepository';
import User, { UserProps } from '../../../../domain/entities/User';
import UserModel, { UserDocument } from '../models/UserModel';
import userMapper from '../mappers/UserMapper';
import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository';

@injectable()
export default class UserRepository
    extends MongooseBaseRepository<User, UserProps, UserDocument>
    implements IUserRepository{
        
    constructor(){
        super(UserModel, userMapper);
    }

    async findByEmail(email: string): Promise<User | null>{
        const doc = await UserModel.findOne({ email: email.toLowerCase() });
        return doc ? userMapper.toDomain(doc) : null;
    }

    async findByEmailWithPassword(email: string): Promise<(User & { password: string; }) | null>{
        const doc = await UserModel.findOne({ email: email.toLowerCase() }).select('+password');
        return doc ? userMapper.toDomainWithPassword(doc) : null;
    }

    async findByIdWithPassword(id: string): Promise<(User & { password: string; }) | null> {
        const doc = await UserModel.findById(id).select('+password');
        return doc ? userMapper.toDomainWithPassword(doc) : null;
    }

    async emailExists(email: string): Promise<boolean>{
        return await this.exists({ email: email.toLowerCase() });
    }

    async updatePassword(id: string, hashedPassword: string): Promise<void> {
        await UserModel.findByIdAndUpdate(id, {
            password: hashedPassword,
            passwordChangedAt: new Date(Date.now() - 1000)
        });
    }

    async updateLastLogin(id: string): Promise<void>{
        await this.updateById(id, {
            lastLoginAt: new Date()
        });
    }

    async updateAvatar(id: string, avatarUrl: string): Promise<void> {
        await this.updateById(id, { avatar: avatarUrl });
    }
};