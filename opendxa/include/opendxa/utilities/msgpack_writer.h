#pragma once

#include <cstdint>
#include <ostream>
#include <string>
#include <vector>

namespace OpenDXA {

class MsgpackWriter {
public:
    explicit MsgpackWriter(std::ostream& os) : _os(os) {}

    // Scalars
    void write_nil();
    void write_bool(bool v);
    void write_int(int64_t v);
    void write_uint(uint64_t v);
    void write_double(double v);
    void write_str(const std::string& s);

    // Containers
    void write_array_header(uint32_t size);
    void write_map_header(uint32_t size);

    // Convenience helpers
    inline void write_key(const char* s){ write_str(std::string(s)); }
    inline void write_key(const std::string& s){ write_str(s); }

private:
    std::ostream& _os;

    void write_raw(const void* data, size_t size);
    void write_u8(uint8_t v);
    void write_u16(uint16_t v);
    void write_u32(uint32_t v);
    void write_u64(uint64_t v);
};

} 