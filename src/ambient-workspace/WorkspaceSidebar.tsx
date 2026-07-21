import { useEffect, useRef, type ReactNode } from 'react'
import { Tabs } from '@base-ui/react/tabs'
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
  const collapseRef = useRef<HTMLButtonElement | null>(null)
  const railRef = useRef<HTMLButtonElement | null>(null)
  const pendingFocusRef = useRef<'rail' | 'toggle' | null>(null)

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
      <Tabs.Root
        className="workspace-sidebar-collapsible"
        value={activeTab}
        onValueChange={(value) => onTabChange(value as WorkspaceSidebarTab)}
      >
        <div className="workspace-sidebar-tabs">
          <Tabs.List className="workspace-sidebar-tablist" aria-label="Workspace tools" activateOnFocus>
            <Tabs.Tab value="work">Work</Tabs.Tab>
            <Tabs.Tab value="versions">Versions {versionCount}</Tabs.Tab>
          </Tabs.List>
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

        <Tabs.Panel className="workspace-sidebar-panel" value="work">
          {work}
        </Tabs.Panel>
        <Tabs.Panel className="workspace-sidebar-panel" value="versions">
          {versions}
        </Tabs.Panel>
      </Tabs.Root>

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
