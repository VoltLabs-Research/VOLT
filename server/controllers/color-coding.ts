import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import RuntimeError from '@/utilities/runtime/runtime-error';
import DumpStorage from '@/services/dump-storage';
import LammpsDumpParser from '@/parsers/lammps/dump-parser';
import { getModifierPerAtomProps } from '@/utilities/plugins';

export default class ColorCodingController{
    public getProperties = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { trajectoryId, analysisId } = req.params;
        const { timestep } = req.query;

        if(!timestep || !analysisId){
            return next(new RuntimeError('ColorCoding::MissingParams', 400));
        }

        const dumpPath = await DumpStorage.getDump(trajectoryId, String(timestep));
        if(!dumpPath){
            return next(new RuntimeError('ColorCoding::DumpNotFound', 404));
        }

        const parser = new LammpsDumpParser();
        const headerLines = await parser.getHeaderLines(dumpPath);
        // base headers such as: ['id', 'x', 'y', 'z'] should be expected
        const { headers } = parser.extractMetadata(headerLines);
        const modifierProps = await getModifierPerAtomProps(analysisId.toString());

        return res.status(200).json({
            status: 'success',
            data: [...headers, ...modifierProps]
        });
    });
};