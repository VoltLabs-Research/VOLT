const extractServerCode = (data: any): string | undefined => {
    if(!data) return undefined;

    return data?.code;
};

export default extractServerCode;