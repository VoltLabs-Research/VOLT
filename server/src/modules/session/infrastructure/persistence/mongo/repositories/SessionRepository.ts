import { ISessionRepository, PersistedSessionDTO } from '@modules/session/domain/port/ISessionRepository';
import Session, { SessionActivityType, SessionProps } from '@modules/session/domain/entities/Session';
import SessionModel, { SessionDocument } from '@modules/session/infrastructure/persistence/mongo/models/SessionModel';
import sessionMapper from '@modules/session/infrastructure/persistence/mongo/mappers/SessionMapper';
import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

const toPersistedSession = (session: Session): PersistedSessionDTO => {
    return {
        _id: session._id,
        ...session.props
    };
};

@injectable()
export default class SessionRepository
    extends MongooseBaseRepository<Session, SessionProps, SessionDocument>
    implements ISessionRepository{

    constructor(){
        super(SessionModel, sessionMapper);
    }

    async findActiveByUserId(userId: string): Promise<PersistedSessionDTO[]> {
        const docs = await SessionModel
            .find({ user: userId, isActive: true })
            .sort({ lastActivity: -1 });
        return docs.map((doc) => toPersistedSession(this.mapper.toDomain(doc)));
    }

    async findLoginActivity(userId: string, limit: number): Promise<PersistedSessionDTO[]> {
        const docs = await SessionModel
            .find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit);
        return docs.map((doc) => toPersistedSession(this.mapper.toDomain(doc)));
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
        userId: string | null,
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
            action: SessionActivityType.FailedLogin,
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
