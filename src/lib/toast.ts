import { Toast } from '@base-ui/react/toast'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

/** Global manager — usable from anywhere (event handlers, async fns), not just React. */
export const toastManager = Toast.createToastManager()

type Options = { description?: string; duration?: number }

function emit(variant: ToastVariant, title: string, opts?: Options) {
  return toastManager.add({
    title,
    description: opts?.description,
    type: variant,
    timeout: opts?.duration,
  })
}

export const toast = {
  success: (title: string, opts?: Options) => emit('success', title, opts),
  error: (title: string, opts?: Options) => emit('error', title, opts),
  warning: (title: string, opts?: Options) => emit('warning', title, opts),
  info: (title: string, opts?: Options) => emit('info', title, opts),
  message: (title: string, opts?: Options) => emit('info', title, opts),
}
