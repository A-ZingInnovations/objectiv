import { useSyncExternalStore } from 'react'
import type { EventStoreApi } from './eventStore'

export function useAgentExecutionRevision(store: EventStoreApi): number {
  return useSyncExternalStore(store.subscribe, store.getRevision, store.getRevision)
}