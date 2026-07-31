import { Collapsible } from '@base-ui/react/collapsible'
import { Popover } from '@base-ui/react/popover'
import { IconInfoCircle } from '@tabler/icons-react'
import { useId, type ReactNode } from 'react'
import { buildAgentPrompt, maskAgentAccessUrl } from '@infomiho/agent-work-protocol'
import { trackProductEvent } from '../../../product-metrics/events'
import { toastManager } from '../../../ui/toast'
import { useCopyFeedback } from '../../../ui/use-copy-feedback'
import { CopyFeedbackLabel } from '../../../ui/copy-feedback-label'
import { WorkspaceTaskCard } from '../workspace/WorkspaceTaskCard'

const minimumCopyFeedbackDurationMs = 600

const getAgentPromptContent = (ambientName: string, hasSavedVersion: boolean) => {
  const goal = hasSavedVersion
    ? `Update the codeshot.dev theme "${ambientName}".`
    : `Create a codeshot.dev theme for "${ambientName}".`
  const direction = hasSavedVersion
    ? 'The draft holds the current design. Ask me what should change.'
    : 'Ask me for the visual direction.'

  return {
    goal,
    setup: 'Open this temporary session with an HTTP or web-fetch tool. Read both linked references and fetch the current draft:',
    beforeEditing: `${direction} Do not update the draft until I answer.`,
  }
}

type AgentPromptCardProps = {
  agentAccessUrl: string
  ambientName: string
  hasSavedVersion: boolean
  isPrimary: boolean
  footer?: ReactNode
  variant: 'next' | 'connected' | 'review' | 'update' | 'saved'
  onCopied: () => void
}

const promptCardContent = {
  next: {
    heading: 'Agent prompt',
  },
  connected: {
    heading: 'Give more direction',
  },
  review: {
    heading: 'Request another pass',
  },
  update: {
    heading: 'Update this theme',
  },
  saved: {
    heading: 'Update this theme',
  },
} as const

function AgentAccessInfo({ maskedUrl }: { maskedUrl: string }) {
  const headingId = useId()
  const descriptionId = useId()

  return (
    <Popover.Root>
      <Popover.Trigger
        render={(
          <button
            className="workspace-agent-access-info"
            type="button"
            aria-label={`${maskedUrl}. About temporary access`}
          >
            <code>{maskedUrl}</code>
            <IconInfoCircle aria-hidden="true" />
          </button>
        )}
      />
      <Popover.Portal>
        <Popover.Positioner
          className="workspace-agent-access-positioner"
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <Popover.Popup
            className="workspace-agent-access-popup"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
          >
            <h3 id={headingId}>Temporary agent access</h3>
            <p id={descriptionId}>
              This authenticated URL lets your agent read the working draft and submit updates.
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ExactPromptDisclosure({ prompt }: { prompt: string }) {
  return (
    <Collapsible.Root className="workspace-exact-prompt">
      <Collapsible.Trigger className="workspace-exact-prompt-trigger">
        View raw prompt
      </Collapsible.Trigger>
      <Collapsible.Panel className="workspace-exact-prompt-panel">
        <pre aria-label="Exact agent prompt" tabIndex={0}>{prompt}</pre>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}

function PromptPreview({
  agentAccessUrl,
  ambientName,
  hasSavedVersion,
  prompt,
}: {
  agentAccessUrl: string
  ambientName: string
  hasSavedVersion: boolean
  prompt: string
}) {
  const content = getAgentPromptContent(ambientName, hasSavedVersion)

  return (
    <>
      <div className="workspace-prompt-text">
        <section className="workspace-prompt-section">
          <p>{content.goal}</p>
        </section>
        <section className="workspace-prompt-section">
          <p>
            {content.setup}{' '}
            <span className="workspace-agent-access-inline">
              <AgentAccessInfo maskedUrl={maskAgentAccessUrl(agentAccessUrl)} />
            </span>
          </p>
        </section>
        <section className="workspace-prompt-section">
          <p>{content.beforeEditing}</p>
        </section>
        <ExactPromptDisclosure prompt={prompt} />
      </div>
    </>
  )
}

export function AgentPromptCard({
  agentAccessUrl,
  ambientName,
  hasSavedVersion,
  isPrimary,
  footer,
  variant,
  onCopied,
}: AgentPromptCardProps) {
  const prompt = buildAgentPrompt(getAgentPromptContent(ambientName, hasSavedVersion), agentAccessUrl)
  const copyFeedback = useCopyFeedback()
  const content = promptCardContent[variant]

  const copyPrompt = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(prompt)
      trackProductEvent('Agent Prompt Copied', { surface: 'workspace' })
      copyFeedback.showCopied()
      await new Promise((resolve) => setTimeout(resolve, minimumCopyFeedbackDurationMs))
      onCopied()
    } catch {
      toastManager.add({
        description: 'Could not copy the agent prompt. Select the prompt and copy it manually.',
        priority: 'high',
      })
    }
  }

  if (!isPrimary) {
    return (
      <Collapsible.Root className="workspace-card workspace-prompt-utility">
        <Collapsible.Trigger className="workspace-prompt-utility-trigger">
          Agent prompt
        </Collapsible.Trigger>
        <Collapsible.Panel className="workspace-prompt-utility-content">
          <PromptPreview
            agentAccessUrl={agentAccessUrl}
            ambientName={ambientName}
            hasSavedVersion={hasSavedVersion}
            prompt={prompt}
          />
          <button className="ui-button ui-button-primary" type="button" onClick={copyPrompt}>
            <CopyFeedbackLabel isCopied={copyFeedback.isCopied}>Copy prompt</CopyFeedbackLabel>
          </button>
        </Collapsible.Panel>
      </Collapsible.Root>
    )
  }

  return (
    <WorkspaceTaskCard
      heading={content.heading}
      content={(
        <PromptPreview
          agentAccessUrl={agentAccessUrl}
          ambientName={ambientName}
          hasSavedVersion={hasSavedVersion}
          prompt={prompt}
        />
      )}
      actions={(
        <button className="ui-button ui-button-primary" type="button" onClick={copyPrompt}>
          <CopyFeedbackLabel isCopied={copyFeedback.isCopied}>Copy prompt</CopyFeedbackLabel>
        </button>
      )}
      footer={footer}
    />
  )
}
