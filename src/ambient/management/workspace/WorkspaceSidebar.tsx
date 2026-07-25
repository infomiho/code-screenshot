import type { ReactNode } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import { IconLayoutSidebarRight } from '@tabler/icons-react'
import type { WorkspaceSidebarTab } from './use-workspace-sidebar'

type WorkspaceSidebarProps = {
  activeTab: WorkspaceSidebarTab
  isCollapsed: boolean
  versionCount: number
  versions: ReactNode
  work: ReactNode
  onTabChange: (tab: WorkspaceSidebarTab) => void
  onToggleCollapse: () => void
}

function SidebarPanelIcon() {
  return <IconLayoutSidebarRight className="workspace-panel-icon" aria-hidden="true" />
}

export function WorkspaceSidebar({
  activeTab,
  isCollapsed,
  versionCount,
  versions,
  work,
  onTabChange,
  onToggleCollapse,
}: WorkspaceSidebarProps) {
  const toggleLabel = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'

  return (
    <aside id="workspace-sidebar" className="workspace-sidebar" aria-label="Theme workspace tools">
      <Tabs.Root
        id="workspace-sidebar-content"
        className="workspace-sidebar-collapsible"
        value={activeTab}
        onValueChange={(value) => onTabChange(value as WorkspaceSidebarTab)}
      >
        <div className="workspace-sidebar-tabs">
          <Tabs.List className="workspace-sidebar-tablist" aria-label="Workspace tools" activateOnFocus>
            <Tabs.Tab value="work">Work</Tabs.Tab>
            <Tabs.Tab value="versions">
              <span>Versions</span>
              <span className="workspace-sidebar-tab-count">{versionCount}</span>
            </Tabs.Tab>
          </Tabs.List>
        </div>

        <Tabs.Panel className="workspace-sidebar-panel" value="work">
          {work}
        </Tabs.Panel>
        <Tabs.Panel className="workspace-sidebar-panel" value="versions">
          {versions}
        </Tabs.Panel>
      </Tabs.Root>

      <button
        type="button"
        className="workspace-sidebar-toggle"
        aria-label={toggleLabel}
        aria-expanded={!isCollapsed}
        aria-controls="workspace-sidebar-content"
        title={toggleLabel}
        onClick={onToggleCollapse}
      >
        <SidebarPanelIcon />
      </button>
    </aside>
  )
}
