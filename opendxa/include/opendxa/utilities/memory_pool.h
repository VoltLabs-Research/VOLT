#pragma once

#include <opendxa/core/opendxa.h>
#include <memory_resource>
#include <vector>
#include <ranges>
#include <utility>
#include <type_traits>
#include <expected>
#include <optional>
#include <stacktrace>
#include <print>

namespace OpenDXA{

enum class PoolError : std::uint8_t{
	OutOfMemory,
    InvalidPageSize,
    ResourceUnavailable
};

template <typename T>
class MemoryPool{
public:
	template <typename Self>
	[[nodiscard]] constexpr auto &&pages(this Self&& self) noexcept{
		return std::forward<Self>(self)._pages;
	}

    template <typename Self>
    [[nodiscard]] constexpr size_t size(this Self&& self) noexcept{
        return self._pages.size();
    }

    explicit MemoryPool(size_t pageSize = 1024, 
                       std::pmr::memory_resource* resource = std::pmr::get_default_resource())
        : _pageSize(pageSize)
        , _lastPageSize(pageSize)
        , _resource(resource)
        , _pages(resource)
        , _allocator(resource) {
        
        if(pageSize == 0) [[unlikely]]{
            throw std::invalid_argument("Page size cannot be zero");
        }
    }

    ~MemoryPool(){
        clear();
    }

    MemoryPool(const MemoryPool&) = delete;
    MemoryPool& operator=(const MemoryPool&) = delete;

    MemoryPool(MemoryPool&& other) noexcept 
        : _pageSize(std::exchange(other._pageSize, 1024))
        , _lastPageSize(std::exchange(other._lastPageSize, 1024))
        , _resource(std::exchange(other._resource, nullptr))
        , _pages(std::move(other._pages))
        , _allocator(std::move(other._allocator)) {}

    MemoryPool& operator=(MemoryPool&& other) noexcept{
        if(this != &other){
            clear();
            _pageSize = std::exchange(other._pageSize, 1024);
            _lastPageSize = std::exchange(other._lastPageSize, 1024);
            _resource = std::exchange(other._resource, nullptr);
            _pages = std::move(other._pages);
            _allocator = std::move(other._allocator);
        }
        return *this;
    }

    template <typename... Args>
    [[nodiscard]] std::expected<T*, PoolError> try_construct(Args&&... args) noexcept {
        try{
            auto slot_result = try_allocate_slot();
            if(!slot_result){
                return std::unexpected(slot_result.error());
            }
            
            T* ptr = *slot_result;
            std::construct_at(ptr, std::forward<Args>(args)...);
            return ptr;
        }catch(const std::bad_alloc&){
            return std::unexpected(PoolError::OutOfMemory);
        }catch(...){
            return std::unexpected(PoolError::ResourceUnavailable);
        }
    }

    template <typename... Args>
    [[nodiscard]] T* construct(Args&&... args) {
        auto result = try_construct(std::forward<Args>(args)...);
        if(!result)[[unlikely]]{
            switch (result.error()){
                case PoolError::OutOfMemory:
                    throw std::bad_alloc{};
                case PoolError::InvalidPageSize:
                    throw std::invalid_argument{"Invalid page size"};
                case PoolError::ResourceUnavailable:
                    throw std::runtime_error{"Resource unavailable"};
            }
        }
        return *result;
    }

    void clear(bool keepFirstPage = false) noexcept{
        for(auto&& [i, page] : std::views::enumerate(_pages)){
            T* base = page;
            size_t count = (i + 1 == _pages.size()) ? _lastPageSize : _pageSize;
            auto objects = std::views::iota(0uz, count) 
                         | std::views::transform([base](size_t j) { return base + j; });
            std::ranges::for_each(objects, [](T* ptr) { std::destroy_at(ptr); });
            if(!keepFirstPage || i != 0){
                _allocator.deallocate(base, _pageSize);
            }
        }

        if(keepFirstPage && !_pages.empty()){
            _pages.resize(1);
            _lastPageSize = 0;
        }else{
            _pages.clear();
            _lastPageSize = _pageSize;
        }
    }

    void swap(MemoryPool& other) noexcept 
        requires std::swappable<std::pmr::vector<T*>> &&
                std::swappable<std::pmr::polymorphic_allocator<T>> {
        std::ranges::swap(_pages, other._pages);
        std::swap(_lastPageSize, other._lastPageSize);
        std::swap(_pageSize, other._pageSize);
        std::swap(_allocator, other._allocator);
        std::swap(_resource, other._resource);
    }

private:
    [[nodiscard]] std::expected<T*, PoolError> try_allocate_slot() noexcept{
        try{
            if(_lastPageSize == _pageSize){
                T* newPage = _allocator.allocate(_pageSize);
                if(!newPage) [[unlikely]]{
                    return std::unexpected(PoolError::OutOfMemory);
                }
                
                _pages.push_back(newPage);
                _lastPageSize = 1;
                return newPage;
            }

            return _pages.back() + _lastPageSize++;
        }catch(const std::bad_alloc&){
            return std::unexpected(PoolError::OutOfMemory);
        }catch (...){
            return std::unexpected(PoolError::ResourceUnavailable);
        }
    }
	
	std::size_t _pageSize;
    std::size_t _lastPageSize;
    std::pmr::memory_resource* _resource;
    std::pmr::vector<T*> _pages;
    std::pmr::polymorphic_allocator<T> _allocator;
};

}