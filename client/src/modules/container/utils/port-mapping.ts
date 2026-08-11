import type { PortMapping } from '@volt/contracts/modules/container/domain';
import type { PortMappingFormItem } from '@/modules/container/contracts/forms';

export const normalizePortMapping = (port: PortMapping): PortMappingFormItem => {
    if (!port.public || port.public <= 0) {
        return { private: port.private };
    }

    return {
        private: port.private,
        public: port.public
    };
};
