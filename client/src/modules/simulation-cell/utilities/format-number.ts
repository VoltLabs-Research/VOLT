export const formatNumber = (num: number): string => {
    if(num === 0) return '0';

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';

    if(absNum >= 1000000000){
        return sign + (absNum / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
    }

    if(absNum >= 1000000){
        return sign + (absNum / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    }

    if(absNum >= 1000){
        return sign + (absNum / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
    }

    return sign + absNum.toString();
};
