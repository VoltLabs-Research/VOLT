import type { PortMapping } from '@volt/contracts/modules/container/domain';
import type { PortMappingFormItem } from '@/modules/container/contracts/forms';

/**
 * A public port is only meaningful when it is a positive number: both `undefined`
 * and `0` mean "let the runtime assign one", so the field is omitted instead.
 */
export const normalizePortMapping = (port: PortMapping): PortMappingFormItem => {
    if (!port.public || port.public <= 0) {
        return { private: port.private };
    }

    return {
        private: port.private,
        public: port.public
    };
};
