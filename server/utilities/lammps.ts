export interface TimestepInfo{
    timestep: number;
    natoms: number;
    boxBounds: {
        xlo: number;
        xhi: number;
        ylo: number;
        yhi: number;
        zlo: number;
        zhi: number;
    }
};

export const extractTimesteps = (lines: string[]): number[] => {
    const timesteps: number[] = [];
    for(let i = 0; i < lines.length; i++){
        const line = lines[i].trim();
        
        if(line === 'ITEM: TIMESTEP'){
            const nextLine = lines[i + 1];
            if(nextLine){
                const timestep = parseInt(nextLine.trim());
                if(!isNaN(timestep)){
                    timesteps.push(timestep);
                }
            }
        }
    }

    return timesteps;
};

const extractTimestepInfo = (lines: string[]): TimestepInfo | null => {
    let timestep: number | null = null;
    let natoms: number | null = null;
    const boxBounds = { xlo: 0, xhi: 0, ylo: 0, yhi: 0, zlo: 0, zhi: 0 };
    
    for(let i = 0; i < lines.length; i++){
        const line = lines[i].trim();
        if(line === 'ITEM: TIMESTEP'){
            const nextLine = lines[i + 1];
            if(nextLine){
                timestep = parseInt(nextLine.trim());
            }
        }

        if(line === 'ITEM: NUMBER OF ATOMS'){
            const nextLine = lines[i + 1];
            if(nextLine){
                natoms = parseInt(nextLine.trim());
            }
        }

        if(line.startsWith('ITEM: BOX BOUNDS')){
            for(let j = 1; j <= 3; j++){
                const boundLine = lines[i + j];
                if(boundLine){
                    const bounds = boundLine.trim().split(/\s+/).map(Number);
                    if(bounds.length >= 2){
                        if(j === 1){
                            boxBounds.xlo = bounds[0];
                            boxBounds.xhi = bounds[1];
                        }else if(j === 2){
                            boxBounds.ylo = bounds[0];
                            boxBounds.yhi = bounds[1];
                        }else if(j === 3){
                            boxBounds.zlo = bounds[0];
                            boxBounds.zhi = bounds[1];
                        }
                    }
                }
            }
        }
    }

    if(timestep !== null && natoms !== null){
        return { timestep, natoms, boxBounds };
    }

    return null;
};

export const isValidLammpsFile = (lines: string[]): boolean => {
    const requiredItems = [
        'ITEM: TIMESTEP',
        'ITEM: NUMBER OF ATOMS',
        'ITEM: BOX BOUNDS',
        'ITEM: ATOMS'
    ];
    
    const content = lines.join('\n');
    return requiredItems.every((item) => content.includes(item));
};

export const getFileStats = (lines: string[]): {
    totalLines: number;
    timesteps: number[];
    isValid: boolean;
    timestepCount: number;
} => {
    const timesteps = extractTimesteps(lines);
    return {
        totalLines: lines.length,
        timesteps,
        isValid: isValidLammpsFile(lines),
        timestepCount: timesteps.length
    };
};