import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { UserDocument } from '@modules/auth/models/UserModel';
import User from '@modules/auth/entities/User';
import type { UserProps } from '@modules/auth/entities/User';
import type { UserWithPassword } from '@modules/auth/ports/IUserRepository';
import type { HydratedDocument } from 'mongoose';

class UserMapper extends BaseMapper<User, UserProps, UserDocument>{
    constructor(){
        super(User, [
            'teams',
            'analyses'
        ]);
    }

    toDomainWithPassword(doc: HydratedDocument<UserDocument>): UserWithPassword {
        const user = this.toDomain(doc);
        return Object.assign(user, { password: doc.password || '' });
    }
}

export default new UserMapper();
