import { HydratedDocument } from "mongoose";
import User, { OAuthProvider, UserProps } from "../../../../domain/entities/User";
import { UserDocument } from "../models/UserModel";
import { IMapper } from "@/src/shared/infrastructure/persistence/IMapper";

class UserMapper
    implements IMapper<User, UserProps, UserDocument>{

    toDomain(doc: UserDocument): User{
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

    toDomainWithPassword(doc: HydratedDocument<UserDocument>): User & { password: string } {
        const user = this.toDomain(doc);
        return Object.assign(user, { password: doc.password || '' });
    }

    toPersistence(data: UserProps): Partial<UserDocument>{
        return {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            password: data.password,
            oauthProvider: data.oauthProvider,
            oauthId: data.oauthId,
            avatar: data.avatar
        };
    }
};

export default new UserMapper();