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
  if (value instanceof Date) return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (typeof value === 'string') return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (typeof (value as any).toDate === 'function') {
    try {
      return (value as Timestamp).toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
  const [activeView, setActiveView] = useState<'dashboard' | 'settings'>('dashboard')
  
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

  // Analytics data
  const priceDistribution = useMemo(() => {
    const ranges = [
      { label: '<$50k', min: 0, max: 50000, count: 0 },
      { label: '$50k-$100k', min: 50000, max: 100000, count: 0 },
      { label: '$100k-$250k', min: 100000, max: 250000, count: 0 },
      { label: '$250k-$500k', min: 250000, max: 500000, count: 0 },
      { label: '>$500k', min: 500000, max: Infinity, count: 0 },
    ]

    listings.forEach((listing) => {
      const price = extractPrice(listing.price)
      if (price > 0) {
        const range = ranges.find((r) => price >= r.min && price < r.max)
        if (range) range.count++
      }
    })

    const maxCount = Math.max(...ranges.map((r) => r.count), 1)
    return ranges.map((r) => ({ ...r, percentage: (r.count / maxCount) * 100 }))
  }, [listings])

  const stateDistribution = useMemo(() => {
    const stateCounts: { [key: string]: number } = {}
    listings.forEach((listing) => {
      if (listing.state) {
        stateCounts[listing.state] = (stateCounts[listing.state] || 0) + 1
      }
    })

    const sorted = Object.entries(stateCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)

    const maxCount = Math.max(...sorted.map(([, count]) => count), 1)
    return sorted.map(([state, count]) => ({
      state,
      count,
      percentage: (count / maxCount) * 100,
    }))
  }, [listings])

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

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          {/* Company Logo */}
          <div className="flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Company Logo" 
              className="h-12 w-auto object-contain"
              onError={(e) => {
                // Fallback if logo doesn't exist yet
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) (fallback as HTMLElement).style.display = 'block';
              }}
            />
            <div className="text-center" style={{ display: 'none' }}>
              <h1 className="text-xl font-bold text-white">Your Company</h1>
              <p className="text-xs text-slate-400 mt-1">Add logo.png to public folder</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-2 ${
              activeView === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="font-medium">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveView('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeView === 'settings'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium">Settings</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-sm text-slate-400">Total Listings</p>
            <p className="text-2xl font-bold text-white mt-1">{listings.length}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Center - Listings */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with filters */}
          <div className="bg-slate-900 border-b border-slate-800 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Business Listings</h2>
              <p className="text-slate-400">
                Showing {filteredListings.length} of {listings.length} listings
              </p>
            </div>

            {/* Search and Quick Filters */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-5">
                <input
                  type="text"
                  placeholder="Search businesses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-3">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
                >
                  <option value="all">All States</option>
                  {states.map((state) => (
                    <option key={state} value={state} className="capitalize">
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  placeholder="Min Price"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="price-low">Price ↑</option>
                  <option value="price-high">Price ↓</option>
                  <option value="name">Name A-Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Listings Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  <p className="text-slate-400">Loading listings...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-xl font-semibold text-white mb-2">No listings found</h3>
                  <p className="text-slate-400 mb-4">Try adjusting your filters</p>
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                {filteredListings.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-blue-500 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-md text-xs text-slate-300 capitalize">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {item.state || 'Unknown'}
                      </span>
                      <span className="text-xs text-slate-500">{formatUploadedAt(item.uploadedAt)}</span>
                    </div>

                    <h3 className="text-white font-semibold text-base leading-tight mb-4 line-clamp-2 group-hover:text-blue-400 transition-colors">
                      {item.name || 'Untitled Business'}
                    </h3>

                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-white">{formatPrice(item.price)}</span>
                      <svg className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Insights */}
        <aside className="w-96 bg-slate-900 border-l border-slate-800 overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-bold text-white mb-6">Insights</h3>

            {/* Price Distribution */}
            <div className="mb-8">
              <h4 className="text-sm font-semibold text-slate-400 mb-4">Price Distribution</h4>
              <div className="space-y-3">
                {priceDistribution.map((range) => (
                  <div key={range.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-slate-300">{range.label}</span>
                      <span className="text-sm text-slate-400">{range.count}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                        style={{ width: `${range.percentage}%` }}
                      />
                </div>
                  </div>
                ))}
                  </div>
                  </div>

            {/* State Distribution - US Map */}
            <div className="mb-8">
              <h4 className="text-sm font-semibold text-slate-400 mb-4">State Distribution</h4>
              <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700/50">
                <div className="relative inline-block w-full">
                  {/* US Map PNG - wrapper to position bars relative to image */}
                  <div className="relative inline-block w-full max-h-[350px]">
                    <img 
                      src="/usa.png" 
                      alt="United States Map" 
                      className="w-full h-auto max-h-[350px] object-contain block"
                    />
                    
                    {/* Florida 3D Bar - positioned relative to image, bottom right of actual map */}
                    {(() => {
                      const florida = stateDistribution.find(s => s.state?.toLowerCase() === 'florida' || s.state?.toLowerCase() === 'fl');
                      if (!florida) return null;
                      
                      const barHeight = Math.max((florida.percentage / 100) * 120, 40); // Smaller max height
                      
                      return (
                        <div 
                          className="absolute flex flex-col items-center justify-end pointer-events-none"
                          style={{
                            left: '89%',  // Position relative to image width - moved right
                            bottom: '17%',  // Position from bottom of image - moved down
                            transform: 'translate(-50%, 0)',
                          }}
                        >
                          {/* Number at top of bar - always visible */}
                          <div className="-mb-3 relative z-10 pointer-events-none">
                            <p className="text-xs font-bold text-white drop-shadow-lg">{florida.count}</p>
                          </div>
                          
                          {/* Light beam effect - fades gradually at top like flashlight */}
                          <div 
                            className="relative flex flex-col items-center justify-end group" 
                            style={{ 
                              pointerEvents: 'auto',
                              width: '0.75rem',
                              height: `${barHeight + 6}px`, // Include semicircle extending below
                            }}
                            onMouseEnter={(e) => {
                              const beam = e.currentTarget.querySelector('.light-beam') as HTMLElement;
                              const semicircle = e.currentTarget.querySelector('.light-semicircle') as HTMLElement;
                              const tooltip = e.currentTarget.parentElement?.querySelector('.state-tooltip') as HTMLElement;
                              if (beam) {
                                beam.style.background = 'linear-gradient(to top, rgba(251, 146, 60, 0.6) 0%, rgba(251, 146, 60, 0.65) 15%, rgba(251, 146, 60, 0.7) 35%, rgba(251, 146, 60, 0.65) 55%, rgba(251, 146, 60, 0.55) 70%, rgba(251, 146, 60, 0.4) 82%, rgba(251, 146, 60, 0.2) 90%, rgba(251, 146, 60, 0.08) 96%, transparent 100%)';
                                beam.style.boxShadow = '0 0 30px rgba(251, 146, 60, 0.5), 0 0 50px rgba(251, 146, 60, 0.3), 0 0 70px rgba(251, 146, 60, 0.2)';
                              }
                              if (semicircle) {
                                semicircle.style.background = 'rgba(251, 146, 60, 0.8)';
                                semicircle.style.boxShadow = '0 0 12px rgba(251, 146, 60, 0.6), 0 0 20px rgba(251, 146, 60, 0.4), 0 0 30px rgba(251, 146, 60, 0.2)';
                              }
                              if (tooltip) tooltip.style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                              const beam = e.currentTarget.querySelector('.light-beam') as HTMLElement;
                              const semicircle = e.currentTarget.querySelector('.light-semicircle') as HTMLElement;
                              const tooltip = e.currentTarget.parentElement?.querySelector('.state-tooltip') as HTMLElement;
                              if (beam) {
                                beam.style.background = 'linear-gradient(to top, rgba(251, 146, 60, 0.35) 0%, rgba(251, 146, 60, 0.4) 15%, rgba(251, 146, 60, 0.5) 35%, rgba(251, 146, 60, 0.4) 55%, rgba(251, 146, 60, 0.3) 70%, rgba(251, 146, 60, 0.2) 82%, rgba(251, 146, 60, 0.1) 90%, rgba(251, 146, 60, 0.04) 96%, transparent 100%)';
                                beam.style.boxShadow = '0 0 20px rgba(251, 146, 60, 0.4), 0 0 40px rgba(251, 146, 60, 0.2), 0 0 60px rgba(251, 146, 60, 0.1)';
                              }
                              if (semicircle) {
                                semicircle.style.background = 'rgba(251, 146, 60, 0.55)';
                                semicircle.style.boxShadow = '0 0 8px rgba(251, 146, 60, 0.4), 0 0 15px rgba(251, 146, 60, 0.2)';
                              }
                              if (tooltip) tooltip.style.opacity = '0';
                            }}
                          >
                            <div 
                              className="w-3 light-beam transform relative overflow-visible"
                              style={{ 
                                height: `${barHeight}px`,
                                background: 'linear-gradient(to top, rgba(251, 146, 60, 0.35) 0%, rgba(251, 146, 60, 0.4) 15%, rgba(251, 146, 60, 0.5) 35%, rgba(251, 146, 60, 0.4) 55%, rgba(251, 146, 60, 0.3) 70%, rgba(251, 146, 60, 0.2) 82%, rgba(251, 146, 60, 0.1) 90%, rgba(251, 146, 60, 0.04) 96%, transparent 100%)',
                                borderRadius: '0',
                                maskImage: 'linear-gradient(to top, black 0%, black 70%, rgba(0,0,0,0.9) 85%, rgba(0,0,0,0.5) 95%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to top, black 0%, black 70%, rgba(0,0,0,0.9) 85%, rgba(0,0,0,0.5) 95%, transparent 100%)',
                                boxShadow: '0 0 20px rgba(251, 146, 60, 0.4), 0 0 40px rgba(251, 146, 60, 0.2), 0 0 60px rgba(251, 146, 60, 0.1)',
                                transition: 'background 0.2s ease, box-shadow 0.2s ease',
                              }}
                            >
                              {/* Light glow effect */}
                              <div 
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(to right, rgba(253, 186, 116, 0.3), rgba(251, 146, 60, 0.2), transparent)',
                                }}
                              />
                              {/* Inner light core - brighter at bottom, fully fades at top */}
                              <div 
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(to top, rgba(253, 186, 116, 0.25) 0%, rgba(253, 186, 116, 0.15) 50%, rgba(253, 186, 116, 0.05) 80%, transparent 100%)',
                                }}
                              />
                            </div>
                            
                            {/* Semicircular base - half inside bar, half extending below */}
                            <div 
                              className="light-semicircle absolute left-1/2 transform -translate-x-1/2"
                              style={{ 
                                bottom: '-0.3rem',
                                width: '0.75rem',
                                height: '0.375rem',
                                background: 'rgba(251, 146, 60, 0.55)',
                                borderRadius: '0 0 50% 50%',
                                boxShadow: '0 0 8px rgba(251, 146, 60, 0.4), 0 0 15px rgba(251, 146, 60, 0.2)',
                                transition: 'background 0.2s ease, box-shadow 0.2s ease',
                              }}
                            />
                          </div>
                          
                          {/* State name on hover */}
                          <div 
                            className="state-tooltip mt-1 transition-opacity duration-200 pointer-events-none"
                            style={{ opacity: 0 }}
                          >
                            <div className="bg-slate-900/80 border border-slate-600/50 rounded px-2 py-0.5 shadow-lg backdrop-blur-sm">
                              <p className="text-xs font-semibold text-slate-300 uppercase">{florida.state}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Idaho Purple Light Beam - positioned at top left */}
                    {(() => {
                      const idaho = stateDistribution.find(s => s.state?.toLowerCase() === 'idaho' || s.state?.toLowerCase() === 'id');
                      if (!idaho) return null;
                      
                      const barHeight = Math.max((idaho.percentage / 100) * 120, 40);
                      
                      return (
                        <div 
                          className="absolute flex flex-col items-center justify-end pointer-events-none"
                          style={{
                            left: '18%',  // Position relative to image width - moved right
                            bottom: '68%',  // Position from bottom - moved down
                            transform: 'translate(-50%, 0)',
                          }}
                        >
                          {/* Number at top of bar - always visible */}
                          <div className="-mb-3 relative z-10 pointer-events-none">
                            <p className="text-xs font-bold text-white drop-shadow-lg">{idaho.count}</p>
                          </div>
                          
                          {/* Light beam effect - purple */}
                          <div 
                            className="relative flex flex-col items-center justify-end group" 
                            style={{ 
                              pointerEvents: 'auto',
                              width: '0.75rem',
                              height: `${barHeight + 6}px`,
                            }}
                            onMouseEnter={(e) => {
                              const beam = e.currentTarget.querySelector('.light-beam') as HTMLElement;
                              const semicircle = e.currentTarget.querySelector('.light-semicircle') as HTMLElement;
                              const tooltip = e.currentTarget.parentElement?.querySelector('.state-tooltip') as HTMLElement;
                              if (beam) {
                                beam.style.background = 'linear-gradient(to top, rgba(168, 85, 247, 0.6) 0%, rgba(168, 85, 247, 0.65) 15%, rgba(168, 85, 247, 0.7) 35%, rgba(168, 85, 247, 0.65) 55%, rgba(168, 85, 247, 0.55) 70%, rgba(168, 85, 247, 0.4) 82%, rgba(168, 85, 247, 0.2) 90%, rgba(168, 85, 247, 0.08) 96%, transparent 100%)';
                                beam.style.boxShadow = '0 0 30px rgba(168, 85, 247, 0.5), 0 0 50px rgba(168, 85, 247, 0.3), 0 0 70px rgba(168, 85, 247, 0.2)';
                              }
                              if (semicircle) {
                                semicircle.style.background = 'rgba(168, 85, 247, 0.8)';
                                semicircle.style.boxShadow = '0 0 12px rgba(168, 85, 247, 0.6), 0 0 20px rgba(168, 85, 247, 0.4), 0 0 30px rgba(168, 85, 247, 0.2)';
                              }
                              if (tooltip) tooltip.style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                              const beam = e.currentTarget.querySelector('.light-beam') as HTMLElement;
                              const semicircle = e.currentTarget.querySelector('.light-semicircle') as HTMLElement;
                              const tooltip = e.currentTarget.parentElement?.querySelector('.state-tooltip') as HTMLElement;
                              if (beam) {
                                beam.style.background = 'linear-gradient(to top, rgba(168, 85, 247, 0.35) 0%, rgba(168, 85, 247, 0.4) 15%, rgba(168, 85, 247, 0.5) 35%, rgba(168, 85, 247, 0.4) 55%, rgba(168, 85, 247, 0.3) 70%, rgba(168, 85, 247, 0.2) 82%, rgba(168, 85, 247, 0.1) 90%, rgba(168, 85, 247, 0.04) 96%, transparent 100%)';
                                beam.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(168, 85, 247, 0.2), 0 0 60px rgba(168, 85, 247, 0.1)';
                              }
                              if (semicircle) {
                                semicircle.style.background = 'rgba(168, 85, 247, 0.55)';
                                semicircle.style.boxShadow = '0 0 8px rgba(168, 85, 247, 0.4), 0 0 15px rgba(168, 85, 247, 0.2)';
                              }
                              if (tooltip) tooltip.style.opacity = '0';
                            }}
                          >
                            <div 
                              className="w-3 light-beam transform relative overflow-visible"
                              style={{ 
                                height: `${barHeight}px`,
                                background: 'linear-gradient(to top, rgba(168, 85, 247, 0.35) 0%, rgba(168, 85, 247, 0.4) 15%, rgba(168, 85, 247, 0.5) 35%, rgba(168, 85, 247, 0.4) 55%, rgba(168, 85, 247, 0.3) 70%, rgba(168, 85, 247, 0.2) 82%, rgba(168, 85, 247, 0.1) 90%, rgba(168, 85, 247, 0.04) 96%, transparent 100%)',
                                borderRadius: '0',
                                maskImage: 'linear-gradient(to top, black 0%, black 70%, rgba(0,0,0,0.9) 85%, rgba(0,0,0,0.5) 95%, transparent 100%)',
                                WebkitMaskImage: 'linear-gradient(to top, black 0%, black 70%, rgba(0,0,0,0.9) 85%, rgba(0,0,0,0.5) 95%, transparent 100%)',
                                boxShadow: '0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(168, 85, 247, 0.2), 0 0 60px rgba(168, 85, 247, 0.1)',
                                transition: 'background 0.2s ease, box-shadow 0.2s ease',
                              }}
                            >
                              {/* Light glow effect */}
                              <div 
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(to right, rgba(192, 132, 252, 0.3), rgba(168, 85, 247, 0.2), transparent)',
                                }}
                              />
                              {/* Inner light core */}
                              <div 
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(to top, rgba(192, 132, 252, 0.25) 0%, rgba(192, 132, 252, 0.15) 50%, rgba(192, 132, 252, 0.05) 80%, transparent 100%)',
                                }}
                              />
                            </div>
                            
                            {/* Semicircular base - purple */}
                            <div 
                              className="light-semicircle absolute left-1/2 transform -translate-x-1/2"
                              style={{ 
                                bottom: '-0.3rem',
                                width: '0.75rem',
                                height: '0.375rem',
                                background: 'rgba(168, 85, 247, 0.55)',
                                borderRadius: '0 0 50% 50%',
                                boxShadow: '0 0 8px rgba(168, 85, 247, 0.4), 0 0 15px rgba(168, 85, 247, 0.2)',
                                transition: 'background 0.2s ease, box-shadow 0.2s ease',
                              }}
                            />
                          </div>
                          
                          {/* State name on hover */}
                          <div 
                            className="state-tooltip mt-1 transition-opacity duration-200 pointer-events-none"
                            style={{ opacity: 0 }}
                          >
                            <div className="bg-slate-900/80 border border-slate-600/50 rounded px-2 py-0.5 shadow-lg backdrop-blur-sm">
                              <p className="text-xs font-semibold text-slate-300 uppercase">{idaho.state}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Legend */}
                <div className="mt-6 pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
                  <span>Total: {listings.length} listings</span>
                  <span>{stateDistribution.length} states</span>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Avg Price</p>
                <p className="text-lg font-bold text-white">
                  {formatPrice(
                    listings.reduce((sum, l) => sum + extractPrice(l.price), 0) / 
                    listings.filter((l) => extractPrice(l.price) > 0).length
                  )}
                </p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">States</p>
                <p className="text-lg font-bold text-white">{states.length}</p>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App