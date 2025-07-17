#pragma once

#include <opendxa/core/opendxa.h>
#include <array>
#include <algorithm>
#include <functional>

namespace OpenDXA{
    
template <typename T, typename Compare = std::less<T>, int QUEUE_SIZE_LIMIT = 32>
class BoundedPriorityQueue{
public:
    using value_type = T;
    using const_iterator = const value_type*;

    BoundedPriorityQueue(int size, const Compare& comp = Compare())
        : _count(0), _maxSize(size), _comp(comp){
        //assert(size <= QUEUE_SIZE_LIMIT);
    }

    [[nodiscard]] int size() const noexcept{
        return _count;
    }

    void clear() noexcept{
        _count = 0;
    }

    [[nodiscard]] bool full() const noexcept{
        return _count == _maxSize;
    }

    [[nodiscard]] bool empty() const noexcept{
        return _count == 0;
    }

    [[nodiscard]] const value_type& top() const{
        //assert(!empty());
        return _data[0];
    }

    void insert(const value_type &x){
        value_type* data1 = &_data[0] - 1;
        if(full()){
            if(_comp(x, top())){
                int j = 1;
                int k = 2;
                while(k <= _count){
                    value_type* z = &data1[k];
                    if(k < _count && _comp(*z, data1[k + 1])){
                        z = &data1[++k];
                    }

                    if(_comp(*z, x)) break;
                    data1[j] = *z;
                    j = k;
                    k = j << 1;
                }

                data1[j] = x;
            }
        }else{
            int i = ++_count;
            int j;
            while(i >= 2){
                j = i >> 1;
                value_type& y = data1[j];
                if(_comp(x, y)) break;
                data1[i] = y;
                i = j;
            }

            data1[i] = x;
        }
    }

    [[nodiscard]] const_iterator begin() const noexcept{
        return &_data[0];
    }

    [[nodiscard]] const_iterator end() const noexcept{
        return &_data[_count];
    }

    [[nodiscard]] const value_type& operator[](int i) const{
        //assert(i < _count);
        return _data[i];
    }

    void sort(){
        std::sort(_data.begin(), _data.begin() + _count, _comp);
    }

protected:
    int _count;
    int _maxSize;
    std::array<value_type, QUEUE_SIZE_LIMIT> _data{};
    Compare _comp;
};

}