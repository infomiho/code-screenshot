import { useState } from 'react'

export type WorkspaceSidebarTab = 'work' | 'versions'

export function useWorkspaceSidebar(initialTab: WorkspaceSidebarTab = 'work') {
  const [activeTab, setActiveTab] = useState<WorkspaceSidebarTab>(initialTab)

  return {
    activeTab,
    showWork: () => setActiveTab('work'),
    showVersions: () => setActiveTab('versions'),
    setActiveTab,
  }
}
