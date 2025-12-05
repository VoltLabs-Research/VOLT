import BaseParser from '@/parsers/base-parser';
import LammpsDumpParser from '@/parsers/lammps/dump-parser';
import LammpsDataParser from '@/parsers/lammps/data-parser';
import { readLargeFile } from '@/utilities/fs';

export default class TrajectoryParserFactory{
    /**
     * Automatically detects the file format and returns a fully populated ParseResult.
     */
    public static async parse(filePath: string){
        // Peek at header
        const headerLines: string[] = [];
        await readLargeFile(filePath, {
            maxLines: 50,
            onLine: (line) => headerLines.push(line)
        });

        // Select strategy
        let parser: BaseParser;
        if(new LammpsDumpParser().canParse(headerLines)){
            parser = new LammpsDumpParser();
        }else if(new LammpsDataParser().canParse(headerLines)){
            parser = new LammpsDataParser();
        }else{
            throw new Error('UnsupportedTrajectoryFormat');
        }
        
        return parser.parse(filePath);
    }
};