import crudEndpoints from './crud';
import assetEndpoints from './assets';

const endpoints = {
    ...crudEndpoints,
    ...assetEndpoints
};

export default endpoints;
