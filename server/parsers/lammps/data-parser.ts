import BaseParser from '@/parsers/base-parser';
import { FrameMetadata } from '@/types/parser';

export default class LammpsDataParser extends BaseParser{
    private idxId = 0;
    private idxType = -1;
    private idxX = -1;
    private idxY = -1;
    private idxZ = -1;
    private columnsMapped = false;

    canParse(headerLines: string[]): boolean{
        const content = headerLines.join('\n');
        const hasAtomsDef = /^\s*\d+\s+atoms/m.test(content);
        const hasBounds = /xlo\s+xhi/m.test(content);
        return hasAtomsDef && hasBounds;
    }

    extractMetadata(lines: string[]): FrameMetadata{
        let natoms = 0;
        const boxBounds = {
            xlo: 0, xhi: 0,
            ylo: 0, yhi: 0,
            zlo: 0, zhi: 0
        };

        let foundNatoms = false;
        let foundX = false;
        let foundY = false;
        let foundZ = false;

        for(const line of lines){
            const l = line.trim();
            if(!l) continue;

            if(!foundNatoms){
                const match = l.match(/^(\d+)\s+atoms/i);
                if(match){
                    natoms = parseInt(match[1], 10);
                    foundNatoms = true;
                    continue;
                }
            }

            if(!foundX && l.includes('xlo')){
                const parts = l.split(/\s+/);
                if(parts.length >= 2){
                    boxBounds.xlo = parseFloat(parts[0]);
                    boxBounds.xhi = parseFloat(parts[1]);
                    foundX = true;
                }
            }

            if(!foundY && l.includes('ylo')){
                const parts = l.split(/\s+/);
                if(parts.length >= 2){
                    boxBounds.ylo = parseFloat(parts[0]);
                    boxBounds.yhi = parseFloat(parts[1]);
                    foundY = true;
                }
            }

            if(!foundZ && l.includes('zlo')){
                const parts = l.split(/\s+/);
                if(parts.length >= 2){
                    boxBounds.zlo = parseFloat(parts[0]);
                    boxBounds.zhi = parseFloat(parts[1]);
                    foundZ = true;
                }
            }
        }

        if(!foundNatoms || !foundX || !foundY || !foundZ){
            throw new Error('InvalidLammpsDataFile');
        }

        return { timestep: 0, natoms, boxBounds, headers: [] };
    }

    isAtomSection(line: string): boolean{
        const l = line.trim();
        if(/^[A-Z]/.test(l) && !/^Atoms/i.test(l)) return false;

        return /^Atoms/i.test(l);
    }

    parseAtomLine(line: string): void{
        this.scanner.load(line);
        // lazy configuration
        if(!this.columnsMapped){
            this.detectAtomStyle(line);
        }

        let id = 0;
        let type = 0;
        let x = 0.0, y = 0.0, z = 0.0;

        let currentTokenIdx = 0;
        const maxIdx = Math.max(this.idxId, this.idxType, this.idxX, this.idxY, this.idxZ);

        while(currentTokenIdx <= maxIdx){
            if(currentTokenIdx === this.idxId){
                id = this.scanner.nextInt();
            }else if(currentTokenIdx === this.idxType){
                type = this.scanner.nextInt();
            }else if(currentTokenIdx === this.idxX){
                x = this.scanner.nextFloat();
            }else if(currentTokenIdx === this.idxY){
                y = this.scanner.nextFloat();
            }else if(currentTokenIdx === this.idxZ){
                z = this.scanner.nextFloat();
            }else{
                this.scanner.jump(1);
            }
            currentTokenIdx++;
        }
        this.pushAtom(type, x, y, z, id);
    }

    getColumns(): string[]{
        return [];
    }

    private detectAtomStyle(firstLine: string){
        const tokens = firstLine.trim().split(/\s+/);
        const colCount = tokens.length;
        this.idxId = 0;
        this.idxType = 1;
        this.idxX = 2;
        this.idxY = 3;
        this.idxZ = 4;

        // id type x y z
        if(colCount === 5){
            this.idxType = 1;
            this.idxX = 2;
            this.idxY = 3;
            this.idxZ = 4;
        }else if(colCount >= 7){
            this.idxType = 2;
            this.idxX = 4;
            this.idxY = 5;
            this.idxZ = 6;
        }else if(colCount === 6){
            this.idxType = 1;
            this.idxX = 3;
            this.idxY = 4;
            this.idxZ = 5;
        }else{
            throw new Error('UnsupportedAtomStyle');
        }

        this.columnsMapped = true;
    }
};
