import { useEffect, useState } from 'react'
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

function formatUploadedAt(value: Listing['uploadedAt']): string {
  if (!value) return ''
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'string') return new Date(value).toLocaleString()
  // Firestore Timestamp
  if (typeof (value as any).toDate === 'function') {
    try {
      return (value as Timestamp).toDate().toLocaleString()
    } catch {
      return ''
    }
  }
  return ''
}

function App() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold mb-6">Listings</h1>

        {loading && <div className="text-gray-600">Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="mb-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline font-medium break-words"
                  >
                    {item.name || 'Untitled'}
                  </a>
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <div>
                    <span className="font-semibold">Price: </span>
                    <span>{item.price ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">State: </span>
                    <span>{item.state ?? '—'}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Uploaded: </span>
                    <span>{formatUploadedAt(item.uploadedAt) || '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
