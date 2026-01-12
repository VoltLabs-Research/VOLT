import { ISSHConnectionRepository } from "@/src/modules/ssh/domain/ports/ISSHConnectionRepository";
import SSHConnection, { SSHConnectionProps } from "@/src/modules/ssh/domain/entities/SSHConnection";
import SSHConnectionModel, { SSHConnectionDocument } from "../models/SSHConnectionModel";
import sshConnectionMapper from '../mappers/SSHConnectionMapper';
import { injectable } from "tsyringe";
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";

@injectable()
export default class SSHConnectionRepository
    extends MongooseBaseRepository<SSHConnection, SSHConnectionProps, SSHConnectionDocument>
    implements ISSHConnectionRepository{

    constructor(){
        super(SSHConnectionModel, sshConnectionMapper);
    }
};