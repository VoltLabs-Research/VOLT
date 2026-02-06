import { SessionDocument } from '@modules/session/infrastructure/persistence/mongo/models/SessionModel';
import Session, { SessionProps } from '@modules/session/domain/entities/Session';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class SessionMapper extends BaseMapper<Session, SessionProps, SessionDocument>{
    constructor(){
        super(Session, [
            'user'
        ]);
    }
};

export default new SessionMapper();