import { useEffect, useRef, type ReactNode } from 'react'
import type { WorkspaceSidebarTab } from './use-workspace-sidebar'

type WorkspaceSidebarProps = {
  activeTab: WorkspaceSidebarTab
  isCollapsed: boolean
  statusMessage: string
  versionCount: number
  versions: ReactNode
  work: ReactNode
  onTabChange: (tab: WorkspaceSidebarTab) => void
  onToggleCollapse: () => void
}

const tabs: readonly WorkspaceSidebarTab[] = ['work', 'versions']

export function WorkspaceSidebar({
  activeTab,
  isCollapsed,
  statusMessage,
  versionCount,
  versions,
  work,
  onTabChange,
  onToggleCollapse,
}: WorkspaceSidebarProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const collapseRef = useRef<HTMLButtonElement | null>(null)
  const railRef = useRef<HTMLButtonElement | null>(null)
  const pendingFocusRef = useRef<'rail' | 'toggle' | null>(null)

  const selectTab = (tab: WorkspaceSidebarTab) => {
    onTabChange(tab)
    tabRefs.current[tabs.indexOf(tab)]?.focus()
  }

  const collapse = () => {
    pendingFocusRef.current = 'rail'
    onToggleCollapse()
  }

  const expand = () => {
    pendingFocusRef.current = 'toggle'
    onToggleCollapse()
  }

  useEffect(() => {
    if (pendingFocusRef.current === 'rail') {
      railRef.current?.focus()
    } else if (pendingFocusRef.current === 'toggle') {
      collapseRef.current?.focus()
    }
    pendingFocusRef.current = null
  }, [isCollapsed])

  return (
    <aside id="workspace-sidebar" className="workspace-sidebar" aria-label="Ambient workspace tools">
      <div className="workspace-sidebar-collapsible">
        <div className="workspace-sidebar-tabs">
          <div className="workspace-sidebar-tablist" role="tablist" aria-label="Workspace tools">
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
          <button
            ref={collapseRef}
            type="button"
            className="workspace-sidebar-collapse"
            aria-label="Collapse sidebar"
            aria-expanded={true}
            aria-controls="workspace-sidebar"
            title="Collapse sidebar"
            onClick={collapse}
          >
            <span className="workspace-collapse-chevron" aria-hidden="true" />
          </button>
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
      </div>

      <div className="workspace-live-region" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      <button
        ref={railRef}
        type="button"
        className="workspace-collapsed-rail"
        aria-label="Expand sidebar"
        aria-expanded={false}
        aria-controls="workspace-sidebar"
        title="Expand sidebar"
        onClick={expand}
      >
        <span className="workspace-rail-chevron" aria-hidden="true" />
      </button>
    </aside>
  )
}
