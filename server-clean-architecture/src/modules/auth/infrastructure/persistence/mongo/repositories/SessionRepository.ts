import { ISessionRepository } from "../../../../domain/ports/ISessionRepository";
import Session, { SessionProps } from "../../../../domain/entities/Session";
import SessionModel from '../models/SessionModel';
import SessionMapper from "../mappers/SessionMapper";
import { PaginationOptions } from "../../../../../../shared/domain/IBaseRepository";

export default class SessionRepository implements ISessionRepository{
    async findById(id: string): Promise<Session | null>{
        const doc = await SessionModel.findById(id);
        return doc ? SessionMapper.toDomain(doc): null;
    }

    async findOne(filter: Partial<SessionProps>): Promise<Session | null>{
        const doc = await SessionModel.findOne(filter);
        return doc ? SessionMapper.toDomain(doc) : null;
    }

    async findAll(options: PaginationOptions): Promise<any>{
        const { page, limit } = options;
        const skip = (page - 1) * limit;

        const [docs, total] = await Promise.all([
            SessionModel.find().skip(skip).limit(limit),
            SessionModel.countDocuments() 
        ]);

        return {
            data: docs.map(SessionMapper.toDomain),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async create(data: SessionProps): Promise<Session>{
        const doc = await SessionModel.create(SessionMapper.toPersistence(data));
        return SessionMapper.toDomain(doc);
    }

    async updateById(id: string, data: Partial<SessionProps>): Promise<Session | null>{
        const doc = await SessionModel.findByIdAndUpdate(id, data, { new: true });
        return doc ? SessionMapper.toDomain(doc) : null;
    }

    async updateMany(filter: Partial<SessionProps>, data: Partial<SessionProps>): Promise<number>{
        const result = await SessionModel.updateMany(filter, data);
        return result.modifiedCount;
    }

    async deleteById(id: string): Promise<boolean>{
        const result = await SessionModel.findByIdAndDelete(id);
        return !!result;
    }

    async deleteMany(filter: Partial<SessionProps>): Promise<number> {
        const result = await SessionModel.deleteMany(filter);
        return result.deletedCount;
    }

    async count(filter?: Partial<SessionProps>): Promise<number>{
        return SessionModel.countDocuments(filter);
    }

    async exists(filter: Partial<SessionProps>): Promise<boolean>{
        const count = await SessionModel.countDocuments(filter);
        return count > 0;
    }

    async findByToken(token: string): Promise<Session | null>{
        const doc = await SessionModel.findOne({ token, isActive: true });
        return doc ? SessionMapper.toDomain(doc) : null;
    }

    async findActiveByUserId(userId: string): Promise<Session[]> {
        const docs = await SessionModel
            .find({ user: userId, isActive: true })
            .sort({ lastActivity: -1 });

        return docs.map(SessionMapper.toDomain);
    }

    async findLoginActivity(userId: string, limit: number): Promise<Session[]> {
        const docs = await SessionModel
            .find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit);
        return docs.map(SessionMapper.toDomain);
    }

    async deactivateByToken(token: string): Promise<void> {
        await SessionModel.findOneAndUpdate({ token }, { isActive: false });
    }

    async deactivateAllExcept(userId: string, currentToken: string): Promise<number> {
        const result = await SessionModel.updateMany(
            { user: userId, token: { $ne: currentToken }, isActive: true },
            { isActive: false }
        );

        return result.modifiedCount;
    }

    async deactivateAll(userId: string): Promise<number> {
        const result = await SessionModel.updateMany(
            { user: userId, isActive: true },
            { isActive: false }
        );

        return result.modifiedCount;
    }

    async createFailedLogin(
        userId: string, 
        userAgent: string, 
        ip: string, 
        reason: string
    ): Promise<Session> {
        const doc = await SessionModel.create({
            user: userId,
            token: null,
            userAgent,
            ip,
            isActive: false,
            lastActivity: new Date(),
            action: 'failed_login',
            success: false,
            failureReason: reason
        });

        return SessionMapper.toDomain(doc);
    }

    async updateActivity(sessionId: string): Promise<void> {
        await SessionModel.findByIdAndUpdate(sessionId, { lastActivity: new Date() });
    }
};