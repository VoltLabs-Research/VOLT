import Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import whiteboardMapper from '@modules/whiteboards/infrastructure/persistence/mongo/mappers/WhiteboardMapper';
import WhiteboardModel from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { WhiteboardDocument } from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardModel';

@Singleton()
export default class WhiteboardRepository
    extends MongooseBaseRepository<Whiteboard, WhiteboardProps, WhiteboardDocument>
    implements IWhiteboardRepository {

    constructor() {
        super(WhiteboardModel, whiteboardMapper);
    }

    async findByTeamAndWhiteboardId(teamId: string, whiteboardId: string): Promise<Whiteboard | null> {
        const doc = await this.model.findOne({ _id: whiteboardId, team: teamId }).exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }
};
