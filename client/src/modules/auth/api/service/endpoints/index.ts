import crud from './crud';
import auth from './auth';
import password from './password';

export default {
    ...crud,
    ...auth,
    ...password
};
