import { HydratedDocument } from 'mongoose';
import User, { UserProps } from '@modules/auth/domain/entities/User';
import { UserDocument } from '@modules/auth/infrastructure/persistence/mongo/models/UserModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class UserMapper extends BaseMapper<User, UserProps, UserDocument>{
    constructor(){
        super(User, [
            'teams',
            'analyses'
        ]);
    }

    toDomainWithPassword(doc: HydratedDocument<UserDocument>): User & { password: string } {
        const user = this.toDomain(doc);
        return Object.assign(user, { password: doc.password || '' });
    }
};

export default new UserMapper();