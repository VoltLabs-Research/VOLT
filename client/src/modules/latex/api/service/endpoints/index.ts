import crudEndpoints from './crud';
import assetEndpoints from './assets';
import transferEndpoints from './transfer';
import fileEndpoints from './files';

const endpoints = {
    ...crudEndpoints,
    ...assetEndpoints,
    ...transferEndpoints,
    ...fileEndpoints
};

export default endpoints;
