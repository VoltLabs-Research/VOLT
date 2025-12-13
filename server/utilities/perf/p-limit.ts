const pLimit = (concurrency: number) => {
    const queue: (() => Promise<any>)[] = [];
    let activeCount = 0;

    const next = () => {
        activeCount--;
        if(queue.length > 0){
            queue.shift()!();
        }
    }

    return <T>(fn: () => Promise<T>): Promise<T> => {
        return new Promise((resolve, reject) => {
            const run = async() => {
                activeCount++;
                try{
                    resolve(await fn());
                }catch(err){
                    reject(err);
                }finally{
                    next();
                }
            };

            if(activeCount < concurrency){
                run();
            }else{
                queue.push(run);
            }
        });
    };
};

export default pLimit;
