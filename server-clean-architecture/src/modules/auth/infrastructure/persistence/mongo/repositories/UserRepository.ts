import mongoose from 'mongoose';
import { IUserRepository } from '../../../../domain/ports/IUserRepository';
import User, { OAuthProvider, UserProps } from '../../../../domain/entities/User';
import UserModel from '../models/UserModel';
import UserMapper from '../mappers/UserMapper';
import { PaginatedResult, PaginationOptions } from '../../../../../../shared/domain/IBaseRepository';

export default class UserRepository implements IUserRepository{
    async findById(id: string): Promise<User | null>{
        const doc = await UserModel.findById(id);
        return doc ? UserMapper.toDomain(doc) : null;
    }

    async findOne(filter: Partial<UserProps>): Promise<User | null>{
        const doc = await UserModel.findOne(filter);
        return doc ? UserMapper.toDomain(doc) : null;
    }

    async findAll(options: PaginationOptions): Promise<any>{
        const { page, limit } = options;
        const skip = (page - 1) * limit;

        const [docs, total] = await Promise.all([
            UserModel.find().skip(skip).limit(limit),
            UserModel.countDocuments()
        ]);

        return {
            data: docs.map(UserMapper.toDomain),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        }
    }

    async create(data: UserProps): Promise<User>{
        const doc = await UserModel.create(UserMapper.toPersistence(data));
        return UserMapper.toDomain(doc);
    }

    async updateById(id: string, data: Partial<UserProps>): Promise<User | null>{
        const doc = await UserModel.findByIdAndUpdate(id, data, { new: true });
        return doc ? UserMapper.toDomain(doc) : null;
    }

    async updateMany(filter: Partial<UserProps>, data: Partial<UserProps>): Promise<number>{
        const result = await UserModel.updateMany(filter, data);
        return result.modifiedCount;
    }

    async deleteById(id: string): Promise<boolean>{
        const result = await UserModel.findByIdAndDelete(id);
        return !!result;
    }

    async deleteMany(filter: Partial<UserProps>): Promise<number>{
        const result = await UserModel.deleteMany(filter);
        return result.deletedCount;
    }

    async count(filter?: Partial<UserProps>): Promise<number>{
        return UserModel.countDocuments(filter);
    }

    async exists(filter: Partial<UserProps>): Promise<boolean>{
        const count = await UserModel.countDocuments(filter);
        return count > 0;
    }

    async findByEmail(email: string): Promise<User | null>{
        const doc = await UserModel.findOne({ email: email.toLowerCase() });
        return doc ? UserMapper.toDomain(doc) : null;
    }

    async findByEmailWithPassword(email: string): Promise<(User & { password: string; }) | null>{
        const doc = await UserModel.findOne({ email: email.toLowerCase() }).select('+password');
        return doc ? UserMapper.toDomainWithPassword(doc) : null;
    }

    async findByIdWithPassword(id: string): Promise<(User & { password: string; }) | null> {
        const doc = await UserModel.findById(id).select('+password');
        return doc ? UserMapper.toDomainWithPassword(doc) : null;
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