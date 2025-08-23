const isType111Half = (bx: number, by: number, bz: number, tol: number): boolean => {
    const components = [bx, by, bz].filter(x => x > tol);
    if(components.length !== 3) return false;
    
    const maxComp = Math.max(...components);
    const minComp = Math.min(...components);
    
    return (maxComp - minComp) / maxComp < tol && maxComp > 0.4 && maxComp < 0.6;
}

const isType100 = (bx: number, by: number, bz: number, tol: number): boolean => {
    const nonZeroCount = [bx, by, bz].filter(x => x > tol).length;
    return nonZeroCount === 1;
}

const isType110 = (bx: number, by: number, bz: number, tol: number): boolean => {
    const components = [bx, by, bz].sort((a, b) => b - a);
    return Math.abs(components[0] - components[1]) < tol && components[2] < tol;
}

const isType111 = (bx: number, by: number, bz: number, tol: number): boolean => {
    const maxComp = Math.max(bx, by, bz);
    if(maxComp < tol) return false;
    
    const ratio1 = Math.abs(bx / maxComp - 1);
    const ratio2 = Math.abs(by / maxComp - 1);
    const ratio3 = Math.abs(bz / maxComp - 1);
    
    return ratio1 < tol && ratio2 < tol && ratio3 < tol && maxComp >= 0.8;
}

const isType112Sixth = (bx: number, by: number, bz: number, tol: number): boolean => {
    const components = [bx, by, bz].sort((a, b) => b - a);
    if (components[0] < tol) return false;
    
    const ratio1 = Math.abs(components[0] / components[1] - 2);
    const ratio2 = Math.abs(components[1] / components[2] - 1);
    
    return ratio1 < tol && ratio2 < tol && components[0] < 0.4;
}

export const calculateDislocationType = (segment: any, tolerance: number = 1e-6): string => {
    if(!segment.burgers || !segment.burgers.vector || segment.burgers.vector.length !== 3){
        return 'Other';
    }

    const burgersVector = segment.burgers.vector;
    const [bx, by, bz] = burgersVector.map(Math.abs);

    if(isType111Half(bx, by, bz, tolerance)){
        return '1/2<111>';
    }

    if(isType100(bx, by, bz, tolerance)){
        return '<100>';
    }

    if(isType110(bx, by, bz, tolerance)){
        return '<110>';
    }

    if(isType111(bx, by, bz, tolerance)){
        return '<111>';
    }

    if(isType112Sixth(bx, by, bz, tolerance)){
        return '1/6<112>';
    }

    return 'Other';
};