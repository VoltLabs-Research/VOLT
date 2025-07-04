#include <opendxa/core/property_base.h>
#include <stdexcept>
#include <cassert>
#include <cstring> 
#include <cstdio> 
#include <algorithm>  

namespace OpenDXA::Particles{

PropertyBase::PropertyBase()
	: _dataType(DataType::Void)
	, _dataTypeSize(0)
	, _numElements(0)
	, _stride(0)
	, _componentCount(0)
	, _data(nullptr){}

PropertyBase::PropertyBase(
	size_t count,
    DataType dataType,
	size_t componentCount,
	size_t stride, 
	bool initializeMemory
) : _dataType(dataType), _dataTypeSize(0), _numElements(0), _stride(stride), _componentCount(componentCount), _data(nullptr){
	if(_dataType == DataType::Void && _componentCount > 0){
		throw std::runtime_error("PropertyBase: DATATYPE_VOID no puede tener componentCount > 0");
	}

	_dataTypeSize = [dataType]() -> size_t {
		switch(dataType){
			case DataType::Int:
				return sizeof(int);
			case DataType::Float:
				return sizeof(double);
			case DataType::Void:
				return 0;
			default:
				throw std::runtime_error("PropertyBase: Tipo de dato desconocido ID = " + std::to_string(static_cast<int>(dataType)));
		}
	}();

	if(_stride == 0 && _componentCount > 0 && _dataTypeSize > 0){
		_stride = _componentCount * _dataTypeSize;
	}

	if(count > 0 && _stride == 0){
		throw std::runtime_error("PropertyBase: Cannot resize with zero stride");
	}

	if(count > 0){
		resize(count, initializeMemory);
	}
}

PropertyBase::PropertyBase(const PropertyBase& other)
	: _dataType(other._dataType), _dataTypeSize(other._dataTypeSize), _numElements(other._numElements), _stride(other._stride)
	, _componentCount(other._componentCount), _data(nullptr){
	if(_numElements > 0 && _stride > 0){
		const auto bufSize = _numElements * _stride;
		_data = std::make_unique<uint8_t[]>(bufSize);
		std::memcpy(_data.get(), other._data.get(), bufSize);
	}
}

PropertyBase::~PropertyBase() = default;

void PropertyBase::resize(size_t newSize, bool preserveData){
	if(newSize == _numElements) return;
	if(newSize == 0){
		_data.reset();
		_numElements = 0;
		return;
	}

	assert(_stride > 0);
	const auto newBufSize = newSize * _stride;
	auto newData = std::make_unique<uint8_t[]>(newBufSize);

	if(preserveData && _data){
		const auto copySize = std::min(_numElements * _stride, newBufSize);
		std::memcpy(newData.get(), _data.get(), copySize);
	}

	_data = std::move(newData);
	_numElements = newSize;
}

void PropertyBase::filterCopy(const PropertyBase &src, const boost::dynamic_bitset<>& mask){
	assert(src.size() == mask.size());
	assert(stride() == src.stride());
	
	const size_t n = src.size();
	if(_dataType == DataType::Float){
		auto s = src.constDataFloat();
		auto d = dataFloat();
		for(size_t i = 0; i < n; ++i){
			if(!mask.test(i)){
				*d++ = *s++;
			}else{
				++s;
			}
		}
	}else if(_dataType == DataType::Int){
		auto s = src.constDataInt();
		auto d = dataInt();
		for(size_t i = 0; i < n; ++i){
			if(!mask.test(i)){
				*d++ = *s++;
			}else{
				++s;
			}
		}
	}else{
		const uint8_t* s = reinterpret_cast<const uint8_t*>(src.constData());
		uint8_t* d = reinterpret_cast<uint8_t*>(data());
		for(size_t i = 0; i < n; ++i){
			if(!mask.test(i)){
				std::memcpy(d, s, _stride);
				d += _stride;
			}
			s += _stride;
		}
	}
}

void PropertyBase::mappedCopy(const PropertyBase& src, const std::vector<int> &map){
	assert(src.size() == map.size());
	assert(stride() == src.stride());

	const size_t n = src.size();
	if(_dataType == DataType::Float){
		auto s = src.constDataFloat();
		auto d = dataFloat();
		for(size_t i = 0; i < n; ++i){
			d[map[i]] = s[i];
		}
	}else if(_dataType == DataType::Int){
		auto s = src.constDataInt();
		auto d = dataInt();
		for(size_t i = 0; i < n; ++i){
			d[map[i]] = s[i];
		}
	}else{
		const uint8_t* s = reinterpret_cast<const uint8_t*>(src.constData());
		uint8_t* d = reinterpret_cast<uint8_t*>(data());
		for(size_t i = 0; i < n; ++i){
			std::memcpy(d + map[i] * _stride, s + i * _stride, _stride);
		}
	}
}

}