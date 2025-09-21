#include <opendxa/utilities/msgpack_writer.h>
#include <cstring>
#include <limits>

namespace OpenDXA {

void MsgpackWriter::write_raw(const void* data, size_t size){
    _os.write(reinterpret_cast<const char*>(data), static_cast<std::streamsize>(size));
}

void MsgpackWriter::write_u8(uint8_t v){
    write_raw(&v, 1);
}

void MsgpackWriter::write_u16(uint16_t v){
    uint8_t buf[2] = {
        static_cast<uint8_t>(v >> 8), 
        static_cast<uint8_t>(v & 0xFF)
    };
    write_raw(buf, 2);
}

void MsgpackWriter::write_u32(uint32_t v){
    uint8_t buf[4] = {
        static_cast<uint8_t>((v >> 24) & 0xFF),
        static_cast<uint8_t>((v >> 16) & 0xFF),
        static_cast<uint8_t>((v >> 8) & 0xFF),
        static_cast<uint8_t>(v & 0xFF)
    };
    write_raw(buf, 4);
}

void MsgpackWriter::write_u64(uint64_t v){
    uint8_t buf[8] = {
        static_cast<uint8_t>((v >> 56) & 0xFF),
        static_cast<uint8_t>((v >> 48) & 0xFF),
        static_cast<uint8_t>((v >> 40) & 0xFF),
        static_cast<uint8_t>((v >> 32) & 0xFF),
        static_cast<uint8_t>((v >> 24) & 0xFF),
        static_cast<uint8_t>((v >> 16) & 0xFF),
        static_cast<uint8_t>((v >> 8) & 0xFF),
        static_cast<uint8_t>(v & 0xFF)
    };
    write_raw(buf, 8);
}

void MsgpackWriter::write_nil(){
    write_u8(0xC0);
}

void MsgpackWriter::write_bool(bool v){
    write_u8(v ? 0xC3 : 0xC2);
}

void MsgpackWriter::write_int(int64_t v){
    if(v >= 0){
        write_uint(static_cast<uint64_t>(v)); 
        return; 
    }
    if(v >= -32){
        write_u8(static_cast<uint8_t>(0xE0 | (v + 32))); 
        return;
    }
    if(v >= std::numeric_limits<int8_t>::min()){
        write_u8(0xD0); 
        write_u8(static_cast<uint8_t>(v)); 
        return;
    }
    if(v >= std::numeric_limits<int16_t>::min()){
        write_u8(0xD1);
        write_u16(static_cast<uint16_t>(v));
        return;
    }
    if(v >= std::numeric_limits<int32_t>::min()){
        write_u8(0xD2);
        write_u32(static_cast<uint32_t>(v)); 
        return; 
    }
    write_u8(0xD3); 
    write_u64(static_cast<uint64_t>(v));
}

void MsgpackWriter::write_uint(uint64_t v){
    if(v <= 0x7F){
        write_u8(static_cast<uint8_t>(v)); 
        return;
    }
    if(v <= 0xFF){
        write_u8(0xCC); 
        write_u8(static_cast<uint8_t>(v)); 
        return; 
    }
    if(v <= 0xFFFF){
        write_u8(0xCD);
        write_u16(static_cast<uint16_t>(v)); 
        return;
    }
    if(v <= 0xFFFFFFFFULL){
        write_u8(0xCE); 
        write_u32(static_cast<uint32_t>(v)); 
        return;
    }
    write_u8(0xCF); 
    write_u64(v);
}

void MsgpackWriter::write_double(double v){
    // msgpack float64 marker
    write_u8(0xCB);
    static_assert(sizeof(double) == 8, "Unexpected double size");
#if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
    // convert to big-endian
    union { double d; uint8_t b[8]; } u{v};
    uint8_t buf[8] = { u.b[7], u.b[6], u.b[5], u.b[4], u.b[3], u.b[2], u.b[1], u.b[0] };
    write_raw(buf, 8);
#else
    write_raw(&v, 8);
#endif
}

void MsgpackWriter::write_str(const std::string& s){
    size_t n = s.size();
    if(n <= 31){
        write_u8(static_cast<uint8_t>(0xA0 | n)); 
    }else if(n <= 0xFF){
        write_u8(0xD9); 
        write_u8(static_cast<uint8_t>(n));
    }else if(n <= 0xFFFF){
        write_u8(0xDA); 
        write_u16(static_cast<uint16_t>(n)); 
    }else{
        write_u8(0xDB);
        write_u32(static_cast<uint32_t>(n)); 
    }
    write_raw(s.data(), n);
}

void MsgpackWriter::write_array_header(uint32_t size){
    if(size <= 15){
        write_u8(static_cast<uint8_t>(0x90 | size));
    }else if(size <= 0xFFFF){
        write_u8(0xDC); 
        write_u16(static_cast<uint16_t>(size)); 
    }else{
        write_u8(0xDD); 
        write_u32(size); 
    }
}

void MsgpackWriter::write_map_header(uint32_t size){
    if(size <= 15){ 
        write_u8(static_cast<uint8_t>(0x80 | size)); 
    }else if(size <= 0xFFFF){
        write_u8(0xDE); 
        write_u16(static_cast<uint16_t>(size)); 
    }else{
        write_u8(0xDF); 
        write_u32(size);
    }
}

} 
