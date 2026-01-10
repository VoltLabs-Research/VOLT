import { HydratedDocument } from "mongoose";
import { SessionDocument } from "../models/SessionModel";
import Session, { SessionProps } from "../../../../domain/entities/Session";
import { IMapper } from "@/src/shared/infrastructure/persistence/IMapper";

class SessionMapper 
    implements IMapper<Session, SessionProps, SessionDocument>{

    toDomain(doc: HydratedDocument<SessionDocument>): Session{
        const props = {
            user: doc.user._id.toString(),
            token: doc.token,
            userAgent: doc.userAgent,
            ip: doc.ip,
            isActive: doc.isActive,
            lastActivity: doc.lastActivity,
            action: doc.action,
            success: doc.success,
            failureReason: doc.failureReason,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };

        return new Session(doc._id.toString(), props);
    }

    toPersistence(data: SessionProps): Partial<SessionDocument>{
        return {
            user: data.user as any,
            token: data.token,
            userAgent: data.userAgent,
            ip: data.ip,
            isActive: data.isActive,
            lastActivity: data.lastActivity,
            action: data.action,
            success: data.success,
            failureReason: data.failureReason
        };
    }
};

export default new SessionMapper();