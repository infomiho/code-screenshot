import { Toast } from '@base-ui/react/toast'
import { IconX } from '@tabler/icons-react'
import './toast.css'

export const toastManager = Toast.createToastManager()

function ToastList() {
  const { toasts } = Toast.useToastManager()

  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className="app-toast" swipeDirection="up">
      <Toast.Content className="app-toast-content">
        <Toast.Description className="app-toast-description" />
        <Toast.Close className="app-toast-close" aria-label="Dismiss notification">
          <IconX aria-hidden="true" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager} timeout={4000} limit={3}>
      <Toast.Portal>
        <Toast.Viewport className="app-toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
