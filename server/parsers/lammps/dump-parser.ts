import BaseParser from '@/parsers/base-parser';
import { FrameMetadata } from '@/types/parser';
import { readLargeFile } from '@/utilities/fs';

export default class LammpsDumpParser extends BaseParser{
    // Column indices
    private idxType = -1;
    private idxX = -1;
    private idxY = -1;
    private idxZ = -1;
    private idxId = -1;
    private propertyIndices: { [name: string]: number } = {};
    private headers: string[] = [];

    private maxColumnIndex = 0;

    canParse(headerLines: string[]): boolean{
        return headerLines.some((line) => line.includes('ITEM: TIMESTEP'));
    }

    extractMetadata(lines: string[]): FrameMetadata{
        let timestep = 0;
        let natoms = 0;
        const boxBounds = {
            xlo: 0,
            xhi: 0,
            ylo: 0,
            yhi: 0,
            zlo: 0,
            zhi: 0
        };

        // Validation flags
        let foundTimestep = false;
        let foundNatoms = false;
        let foundBounds = false;
        let foundAtomsHeader = false;

        for(let i = 0; i < lines.length; i++){
            const line = lines[i].trim();

            if(line === 'ITEM: TIMESTEP' && lines[i + 1]){
                timestep = parseInt(lines[i + 1].trim(), 10);
                foundTimestep = !isNaN(timestep);
            }else if(line === 'ITEM: NUMBER OF ATOMS' && lines[i + 1]){
                natoms = parseInt(lines[i + 1].trim(), 10);
                foundNatoms = !isNaN(natoms);
            }else if(line.startsWith('ITEM: BOX BOUNDS')){
                const isTriclinic = line.includes('xy') || line.includes('xz') || line.includes('yz');
                if(lines[i + 1] && lines[i + 2] && lines[i + 3]){
                    const xLine = lines[i+1].trim().split(/\s+/).map(Number);
                    const yLine = lines[i+2].trim().split(/\s+/).map(Number);
                    const zLine = lines[i+3].trim().split(/\s+/).map(Number);

                    if(xLine.length >= 2 && yLine.length >= 2 && zLine.length >= 2){
                        boxBounds.xlo = xLine[0];
                        boxBounds.xhi = xLine[1];
                        boxBounds.ylo = yLine[0];
                        boxBounds.yhi = yLine[1];
                        boxBounds.zlo = zLine[0];
                        boxBounds.zhi = zLine[1];
                        foundBounds = true;
                    }
                }
            }else if(line.startsWith('ITEM: ATOMS')){
                this.mapColumns(line);
                foundAtomsHeader = true;
            }
        }

        // Validation
        if(!foundTimestep || !foundNatoms || !foundBounds || !foundAtomsHeader){
            throw new Error('InvalidLammpsDumpsFormat');
        }

        return { timestep, natoms, boxBounds, headers: this.headers };
    }

    // TODO: implement in base parser
    public async getStatsForProperty(filePath: string, property: string): Promise<{ min: number; max: number }>{
        const headerLines = await this.getHeaderLines(filePath);
        this.extractMetadata(headerLines);
        const propIdx = this.headers.findIndex((c) => c === property.toLowerCase());
        if(propIdx === -1){
            throw new Error(`Property ${property} not found in dump file headers.`);
        }

        let min = Infinity, max = -Infinity;
        let inAtomsSection = false;

        await readLargeFile(filePath, {
            onLine: (line) => {
                const trimmedLine = line.trim();
                if(trimmedLine.startsWith('ITEM: ATOMS')){
                    inAtomsSection = true;
                    return;
                }

                if(trimmedLine.startsWith('ITEM:')){
                    inAtomsSection = false;
                    return;
                }

                if(inAtomsSection){
                    this.scanner.load(line);
                    this.scanner.jump(propIdx);
                    const value = this.scanner.nextFloat();
                    // TODO: duplicated validation
                    if(value === value && value < Infinity && value > -Infinity){
                        if(value < min) min = value;
                        if(value > max) max = value;
                    }
                }
            }
        });

        return {
            min: min === Infinity ? 0 : min,
            max: max === -Infinity ? 0 : max
        };
    }

    private mapColumns(headerLine: string){
        this.headers = headerLine.replace(/^ITEM:\s*ATOMS\s*/, '')
            .trim()
            .split(/\s+/)
            .map(c => c.toLowerCase());
        this.idxType = this.headers.findIndex((c) => c === 'type');

        const findCoord = (suffixes: string[]) => this.headers.findIndex((c) => suffixes.includes(c));
        this.idxX = findCoord(['x', 'xu', 'xs']);
        this.idxY = findCoord(['y', 'yu', 'ys']);
        this.idxZ = findCoord(['z', 'zu', 'zs']);

        if(this.parseOptions.includeIds){
            this.idxId = this.headers.findIndex((c) => c === 'id');
        }

        if(this.parseOptions.properties){
            for(const prop of this.parseOptions.properties){
                const idx = this.headers.findIndex((c) => c === prop.toLowerCase());
                if(idx !== -1){
                    this.propertyIndices[prop] = idx;
                }
            }
        }

        if(this.idxType < 0 || this.idxX < 0 || this.idxY < 0 || this.idxZ < 0){
            throw new Error('MissingRequiredColumnsInDumpFile');
        }

        this.maxColumnIndex = Math.max(
            this.idxType,
            this.idxX,
            this.idxY,
            this.idxZ,
            this.idxId,
                ...Object.values(this.propertyIndices)
        );
    }

    isAtomSection(line: string): boolean{
        if(line.startsWith('ITEM: ATOMS')){
            this.mapColumns(line);
            return true;
        }
        if(line.startsWith('ITEM:')) return false;
        return false;
    }

    parseAtomLine(line: string): void{
        this.scanner.load(line);

        let currentTokenIdx = 0;
        let type = 0;
        let x = 0.0, y = 0.0, z = 0.0;
        let id: number | undefined;
        const props: { [name: string]: number } = {};

        while(currentTokenIdx <= this.maxColumnIndex){
            let val: number | undefined;
            let read = false;

            if(currentTokenIdx === this.idxType){
                type = this.scanner.nextInt();
                val = type;
                read = true;
            }else if(currentTokenIdx === this.idxX){
                x = this.scanner.nextFloat();
                val = x;
                read = true;
            }else if(currentTokenIdx === this.idxY){
                y = this.scanner.nextFloat();
                val = y;
                read = true;
            }else if(currentTokenIdx === this.idxZ){
                z = this.scanner.nextFloat();
                val = z;
                read = true;
            }else if(currentTokenIdx === this.idxId){
                id = this.scanner.nextInt();
                val = id;
                read = true;
            }

            for(const propName in this.propertyIndices){
                if(this.propertyIndices[propName] === currentTokenIdx){
                    if(!read){
                        val = this.scanner.nextFloat();
                        read = true;
                    }
                    props[propName] = val!;
                }
            }

            if(!read){
                this.scanner.jump(1);
            }

            currentTokenIdx++;
        }
        this.pushAtom(type, x, y, z, id, props);
    }
};
