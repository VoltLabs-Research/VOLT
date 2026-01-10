import { ISessionRepository } from "../../../../domain/ports/ISessionRepository";
import Session, { SessionProps } from "../../../../domain/entities/Session";
import SessionModel, { SessionDocument } from '../models/SessionModel';
import sessionMapper from "../mappers/SessionMapper";
import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";

@injectable()
export default class SessionRepository
    extends MongooseBaseRepository<Session, SessionProps, SessionDocument>
    implements ISessionRepository{

    constructor(){
        super(SessionModel, sessionMapper);
    }

    async findActiveByUserId(userId: string): Promise<Session[]> {
        const docs = await SessionModel
            .find({ user: userId, isActive: true })
            .sort({ lastActivity: -1 });

        return docs.map(sessionMapper.toDomain);
    }

    async findLoginActivity(userId: string, limit: number): Promise<Session[]> {
        const docs = await SessionModel
            .find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit);
        return docs.map(sessionMapper.toDomain);
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

        return sessionMapper.toDomain(doc);
    }

    async findByToken(token: string): Promise<Session | null>{
        const doc = await SessionModel.findOne({ token, isActive: true });
        return doc ? sessionMapper.toDomain(doc) : null;
    }

    async updateActivity(sessionId: string): Promise<void> {
        await SessionModel.findByIdAndUpdate(sessionId, { lastActivity: new Date() });
    }
};