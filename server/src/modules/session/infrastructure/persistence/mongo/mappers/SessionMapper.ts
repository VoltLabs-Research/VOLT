import Session from '@modules/session/domain/entities/Session';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import type { SessionProps } from '@modules/session/domain/entities/Session';
import type { SessionDocument } from '@modules/session/infrastructure/persistence/mongo/models/SessionModel';

class SessionMapper extends BaseMapper<Session, SessionProps, SessionDocument>{
    constructor(){
        super(Session, [
            'user'
        ]);
    }
};

export default new SessionMapper();
