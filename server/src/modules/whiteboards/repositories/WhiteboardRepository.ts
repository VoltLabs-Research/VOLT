import { WHITEBOARD_TOKENS } from '@modules/whiteboards/di/WhiteboardTokens';
import Whiteboard from '@modules/whiteboards/entities/Whiteboard';
import whiteboardMapper from '@modules/whiteboards/mappers/WhiteboardMapper';
import WhiteboardModel from '@modules/whiteboards/models/WhiteboardModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type { WhiteboardProps } from '@modules/whiteboards/entities/Whiteboard';
import type { IWhiteboardRepository } from '@modules/whiteboards/ports/IWhiteboardRepository';
import type { WhiteboardDocument } from '@modules/whiteboards/models/WhiteboardModel';

@Singleton(WHITEBOARD_TOKENS.WhiteboardRepository)
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
}
