const getQueryParam = (queryParam: string) => {
    const params = new URLSearchParams(window.location.search);
    return params.get(queryParam);
};

export default getQueryParam;