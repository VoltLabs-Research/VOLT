import { createService } from '@/app/core/http/utilities/create-service';
import client from './client';
import endpoints from './endpoints';

const service = createService({ clients: client }, endpoints);

export default service;
