import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore'
import { db } from './firebase'

type Listing = {
  id: string
  name: string
  url: string
  price?: string | number
  state?: string
  uploadedAt?: Timestamp | Date | string | null
}

type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'name'

function formatUploadedAt(value: Listing['uploadedAt']): string {
  if (!value) return ''
  if (value instanceof Date) return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (typeof value === 'string') return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (typeof (value as any).toDate === 'function') {
    try {
      return (value as Timestamp).toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return ''
    }
  }
  return ''
}

function extractPrice(priceStr: string | number | undefined): number {
  if (typeof priceStr === 'number') return priceStr
  if (!priceStr || typeof priceStr !== 'string') return 0
  const cleaned = priceStr.replace(/[$,]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

function formatPrice(price: string | number | undefined): string {
  if (!price) return 'Contact for pricing'
  const numPrice = extractPrice(price)
  if (numPrice === 0) return String(price)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numPrice)
}

function App() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedState, setSelectedState] = useState<string>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const listingsRef = collection(db, 'listings')
        const q = query(listingsRef, orderBy('uploadedAt', 'desc'))
        const snapshot = await getDocs(q)
        const items: Listing[] = snapshot.docs.map((doc) => {
          const data = doc.data() as any
          return {
            id: doc.id,
            name: data.name ?? '',
            url: data.url ?? '#',
            price: data.price,
            state: data.state,
            uploadedAt: data.uploadedAt ?? null,
          }
        })
        setListings(items)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load listings')
      } finally {
        setLoading(false)
      }
    }
    fetchListings()
  }, [])

  const states = useMemo(() => {
    const stateSet = new Set<string>()
    listings.forEach((listing) => {
      if (listing.state) stateSet.add(listing.state)
    })
    return Array.from(stateSet).sort()
  }, [listings])

  const filteredListings = useMemo(() => {
    let filtered = listings.filter((listing) => {
      if (searchTerm && !listing.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      
      if (selectedState !== 'all' && listing.state !== selectedState) {
        return false
      }
      
      const price = extractPrice(listing.price)
      const min = minPrice ? parseFloat(minPrice) : 0
      const max = maxPrice ? parseFloat(maxPrice) : Infinity
      
      if (price > 0 && (price < min || price > max)) {
        return false
      }
      
      return true
    })

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return getTimestamp(b.uploadedAt) - getTimestamp(a.uploadedAt)
        case 'oldest':
          return getTimestamp(a.uploadedAt) - getTimestamp(b.uploadedAt)
        case 'price-low':
          return extractPrice(a.price) - extractPrice(b.price)
        case 'price-high':
          return extractPrice(b.price) - extractPrice(a.price)
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return filtered
  }, [listings, searchTerm, selectedState, minPrice, maxPrice, sortBy])

  function getTimestamp(value: Listing['uploadedAt']): number {
    if (!value) return 0
    if (value instanceof Date) return value.getTime()
    if (typeof value === 'string') return new Date(value).getTime()
    if (typeof (value as any).toDate === 'function') {
      try {
        return (value as Timestamp).toDate().getTime()
      } catch {
        return 0
      }
    }
    return 0
  }

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedState('all')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('newest')
  }

  const hasActiveFilters = searchTerm || selectedState !== 'all' || minPrice || maxPrice || sortBy !== 'newest'

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto max-w-[1600px] px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">BizHub</h1>
              <p className="text-sm text-slate-400 mt-1">Business Marketplace</p>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-sm text-slate-400">
                {listings.length} Active Listings
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-[1600px] px-8 py-12">
        
        {/* Search and Filters Section */}
        <div className="mb-12">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative max-w-3xl">
              <input
                type="text"
                placeholder="Search by business name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-6 py-5 pl-14 bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-lg"
              />
              <svg
                className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Filters Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-semibold text-white">Filters</h2>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset All
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* State Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">
                  State
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all capitalize"
                >
                  <option value="all">All States</option>
                  {states.map((state) => (
                    <option key={state} value={state} className="capitalize">
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              {/* Min Price */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">
                  Min Price
                </label>
                <input
                  type="number"
                  placeholder="$0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Max Price */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">
                  Max Price
                </label>
                <input
                  type="number"
                  placeholder="No limit"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name A-Z</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-8">
          <p className="text-slate-400">
            Showing <span className="text-white font-semibold">{filteredListings.length}</span> of{' '}
            <span className="text-white font-semibold">{listings.length}</span> listings
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-6 text-slate-400">Loading listings...</p>
          </div>
        )}

        {/* Listings Grid */}
        {!loading && !error && (
          <>
            {filteredListings.length === 0 ? (
              <div className="text-center py-32 bg-slate-900 border border-slate-800 rounded-2xl">
                <svg
                  className="mx-auto h-16 w-16 text-slate-700 mb-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-xl font-semibold text-white mb-3">No listings found</h3>
                <p className="text-slate-400 mb-8">Try adjusting your filters or search terms</p>
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredListings.map((item) => (
                  <article
                    key={item.id}
                    className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all duration-300"
                  >
                    <div className="p-8">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-6">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-sm text-slate-300 capitalize">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {item.state || 'Unknown'}
                        </span>
                        <time className="text-xs text-slate-500">
                          {formatUploadedAt(item.uploadedAt)}
                        </time>
                      </div>

                      {/* Title */}
                      <h3 className="mb-6 min-h-[4rem]">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-white hover:text-blue-400 font-semibold text-xl leading-snug line-clamp-2 transition-colors"
                        >
                          {item.name || 'Untitled Business'}
                        </a>
                      </h3>

                      {/* Price */}
                      <div className="mb-8 pb-8 border-b border-slate-800">
                        <p className="text-3xl font-bold text-white">
                          {formatPrice(item.price)}
                        </p>
                      </div>

                      {/* CTA Button */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                      >
                        View Listing
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-[1600px] px-8 py-12">
          <p className="text-center text-slate-500 text-sm">
            Business listings aggregated from BizBuySell
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App