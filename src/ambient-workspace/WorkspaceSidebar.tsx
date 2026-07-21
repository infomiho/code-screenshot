import { useRef, type ReactNode } from 'react'
import type { WorkspaceSidebarTab } from './use-workspace-sidebar'

type WorkspaceSidebarProps = {
  activeTab: WorkspaceSidebarTab
  statusMessage: string
  versionCount: number
  versions: ReactNode
  work: ReactNode
  onTabChange: (tab: WorkspaceSidebarTab) => void
}

const tabs: readonly WorkspaceSidebarTab[] = ['work', 'versions']

export function WorkspaceSidebar({
  activeTab,
  statusMessage,
  versionCount,
  versions,
  work,
  onTabChange,
}: WorkspaceSidebarProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const selectTab = (tab: WorkspaceSidebarTab) => {
    onTabChange(tab)
    tabRefs.current[tabs.indexOf(tab)]?.focus()
  }

  return (
    <aside className="workspace-sidebar" aria-label="Ambient workspace tools">
      <div className="workspace-sidebar-tabs" role="tablist" aria-label="Workspace tools">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            ref={(element) => { tabRefs.current[index] = element }}
            id={`workspace-${tab}-tab`}
            type="button"
            role="tab"
            aria-controls={`workspace-${tab}-panel`}
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => onTabChange(tab)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'End') {
                event.preventDefault()
                selectTab('versions')
              }
              if (event.key === 'ArrowLeft' || event.key === 'Home') {
                event.preventDefault()
                selectTab('work')
              }
            }}
          >
            {tab === 'work' ? 'Work' : `Versions ${versionCount}`}
          </button>
        ))}
      </div>

      <div
        id="workspace-work-panel"
        className="workspace-sidebar-panel"
        role="tabpanel"
        aria-labelledby="workspace-work-tab"
        hidden={activeTab !== 'work'}
      >
        {work}
      </div>
      <div
        id="workspace-versions-panel"
        className="workspace-sidebar-panel"
        role="tabpanel"
        aria-labelledby="workspace-versions-tab"
        hidden={activeTab !== 'versions'}
      >
        {versions}
      </div>

      <div className="workspace-live-region" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>
    </aside>
  )
}
