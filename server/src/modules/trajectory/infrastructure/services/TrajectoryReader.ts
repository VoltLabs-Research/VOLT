import { injectable } from 'tsyringe';
import type { ITrajectoryReader } from '@modules/trajectory/domain/port/ITrajectoryReader';
import type { FrameMetadata, ParseOptions, ParseResult } from '@modules/trajectory/domain/port/ParserTypes';
import TrajectoryParserFactory from '@modules/trajectory/infrastructure/parsers/TrajectoryParserFactory';

@injectable()
export default class TrajectoryReader implements ITrajectoryReader {
    read(filePath: string, options?: ParseOptions): Promise<ParseResult> {
        return TrajectoryParserFactory.parse(filePath, options);
    }

    readMetadata(filePath: string): Promise<FrameMetadata> {
        return TrajectoryParserFactory.parseMetadata(filePath);
    }
}
