import { HydratedDocument } from "mongoose";
import User, { OAuthProvider, UserProps } from "../../../../domain/entities/User";
import { UserDocument } from "../models/UserModel";

export default class UserMapper{
    static toDomain(doc: HydratedDocument<UserDocument>): User{
        const props = {
            email: doc.email,
            firstName: doc.firstName,
            lastName: doc.lastName,
            role: doc.role,
            passwordChangedAt: doc.passwordChangedAt,
            lastLoginAt: doc.lastLoginAt,
            teams: doc.teams.map((team) => team.toString()),
            analyses: doc.analyses.map((analysis) => analysis.toString()),
            oauthProvider: doc.oauthProvider as OAuthProvider,
            oauthId: doc.oauthId,
            avatar: doc.avatar,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };

        return User.create(doc._id.toString(), props);
    }

    static toDomainWithPassword(doc: HydratedDocument<UserDocument>): User & { password: string } {
        const user = UserMapper.toDomain(doc);
        return Object.assign(user, { password: doc.password || '' });
    }

    static toPersistence(entity: Partial<UserProps>): Partial<UserDocument>{
        return {
            email: entity.email,
            firstName: entity.firstName,
            lastName: entity.lastName,
            role: entity.role,
            password: entity.password,
            oauthProvider: entity.oauthProvider,
            oauthId: entity.oauthId,
            avatar: entity.avatar
        };
    }
}