import crudEndpoints from './crud';
import assetEndpoints from './assets';
import transferEndpoints from './transfer';

const endpoints = {
    ...crudEndpoints,
    ...assetEndpoints,
    ...transferEndpoints
};

export default endpoints;
