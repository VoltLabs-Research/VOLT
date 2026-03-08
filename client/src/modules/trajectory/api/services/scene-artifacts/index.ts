import { createService } from '@/app/core/http/utilities/create-service';
import client from './client';
import endpoints from './endpoints';

export default createService({ clients: client }, endpoints);
