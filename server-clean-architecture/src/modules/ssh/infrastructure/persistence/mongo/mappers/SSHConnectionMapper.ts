import SSHConnection, { SSHConnectionProps } from "@/src/modules/ssh/domain/entities/SSHConnection";
import { SSHConnectionDocument } from "../models/SSHConnectionModel";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";

class SSHConnectionMapper extends BaseMapper<SSHConnection, SSHConnectionProps, SSHConnectionDocument>{
    constructor(){
        super(SSHConnection, [
            'user',
            'team'
        ]);
    }
};

export default new SSHConnectionMapper();