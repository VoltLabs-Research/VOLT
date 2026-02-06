export type Bounds = {
    min: [number, number, number];
    max: [number, number, number];
};

const computeBoundsFromPoints = (points: [number, number, number][]): Bounds => {
    if(points.length === 0){
        return {
            min: [0, 0, 0],
            max: [0, 0, 0]
        };
    }

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;

    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for(const [x, y, z] of points){
        if(x < minX) minX = x;
        if(y < minY) minY = y;
        if(z < minZ) minZ = z;
        if(x > maxX) maxX = x;
        if(y > maxY) maxY = y;
        if(z > maxZ) maxZ = z;
    }

    return {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ]
    };
};

export default computeBoundsFromPoints;