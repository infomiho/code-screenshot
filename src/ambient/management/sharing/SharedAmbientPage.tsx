import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getSharedAmbient, useQuery } from 'wasp/client/operations'
import { App } from '../../../app'
import { AmbientSkeleton } from '../../../screenshot/ambient-skeleton'
import type { SharedAmbientDto } from '../contracts'
import './shared-ambient-page.css'

const unavailableToast = 'This shared ambient is no longer available.'

const getStatusCode = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
  return typeof error.statusCode === 'number' ? error.statusCode : null
}

export function SharedAmbientPage() {
  const navigate = useNavigate()
  const { shareId } = useParams<'shareId'>()
  const sharedQuery = useQuery(
    getSharedAmbient,
    { shareId: shareId ?? '' },
    { enabled: Boolean(shareId), retry: false },
  )
  const statusCode = getStatusCode(sharedQuery.error)

  useEffect(() => {
    if (shareId && statusCode !== 400 && statusCode !== 404) return
    navigate('/', { replace: true, state: { toast: unavailableToast } })
  }, [navigate, shareId, statusCode])

  if (sharedQuery.error && statusCode !== 400 && statusCode !== 404) {
    return (
      <main className="shared-ambient-state" role="alert" aria-busy={sharedQuery.isFetching}>
        <span>Shared ambient</span>
        <h1>Could not load this ambient</h1>
        <p>Check your connection and try again.</p>
        <div>
          <button
            className="ui-button ui-button-primary"
            type="button"
            disabled={sharedQuery.isFetching}
            onClick={() => void sharedQuery.refetch()}
          >
            {sharedQuery.isFetching ? 'Trying again…' : 'Try again'}
          </button>
          <button className="ui-button" type="button" onClick={() => navigate('/', { replace: true })}>
            Open editor
          </button>
        </div>
      </main>
    )
  }

  if (!sharedQuery.data) {
    return (
      <main className="shared-ambient-loading" aria-label="Loading shared ambient">
        <AmbientSkeleton />
      </main>
    )
  }

  const shared = sharedQuery.data as SharedAmbientDto
  return (
    <App
      key={`${shared.id}@${shared.version.version}`}
      sharedAmbient={{
        ...shared.version,
        id: shared.id,
      }}
    />
  )
}
