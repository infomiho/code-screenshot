import { useEffect, useState } from 'react'

export type WorkspaceSidebarTab = 'work' | 'versions'

const collapsedStorageKey = 'codeshot.workspace-sidebar-collapsed'

const readStoredCollapsed = () => {
  try {
    return globalThis.localStorage?.getItem(collapsedStorageKey) === 'true'
  } catch {
    return false
  }
}

export function useWorkspaceSidebar(initialTab: WorkspaceSidebarTab = 'work') {
  const [activeTab, setActiveTab] = useState<WorkspaceSidebarTab>(initialTab)
  const [isCollapsed, setIsCollapsed] = useState(readStoredCollapsed)

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(collapsedStorageKey, String(isCollapsed))
    } catch {
      // The layout preference is optional; the workspace works without it.
    }
  }, [isCollapsed])

  return {
    activeTab,
    isCollapsed,
    showWork: () => setActiveTab('work'),
    showVersions: () => setActiveTab('versions'),
    setActiveTab,
    toggleCollapsed: () => setIsCollapsed((collapsed) => !collapsed),
  }
}
