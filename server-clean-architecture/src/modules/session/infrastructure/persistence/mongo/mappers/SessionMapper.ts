import { SessionDocument } from "../models/SessionModel";
import Session, { SessionProps } from "../../../../domain/entities/Session";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";

class SessionMapper extends BaseMapper<Session, SessionProps, SessionDocument>{
    constructor(){
        super(Session, [
            'user'
        ]);
    }
};

export default new SessionMapper();