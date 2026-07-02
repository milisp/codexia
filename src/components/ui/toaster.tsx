import { useToast } from "@/components/ui/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type ToasterPosition =
  | "top-center"
  | "top-right"
  | "top-left"
  | "bottom-center"
  | "bottom-right"
  | "bottom-left"

const viewportByPosition: Record<ToasterPosition, string> = {
  "top-center":
    "left-1/2 top-4 w-full max-w-[420px] -translate-x-1/2 sm:bottom-auto sm:right-auto sm:top-4 sm:flex-col",
  "top-right":
    "right-4 top-4 w-full max-w-[420px] sm:bottom-auto sm:right-4 sm:top-4 sm:flex-col",
  "top-left":
    "left-4 top-4 w-full max-w-[420px] sm:bottom-auto sm:left-4 sm:top-4 sm:flex-col",
  "bottom-center":
    "left-1/2 bottom-4 w-full max-w-[420px] -translate-x-1/2 sm:bottom-4 sm:right-auto sm:top-auto sm:flex-col",
  "bottom-right":
    "right-4 bottom-4 w-full max-w-[420px] sm:bottom-4 sm:right-4 sm:top-auto sm:flex-col",
  "bottom-left":
    "left-4 bottom-4 w-full max-w-[420px] sm:bottom-4 sm:left-4 sm:top-auto sm:flex-col",
}

type ToasterProps = {
  viewportClassName?: string
}

const positions: ToasterPosition[] = [
  "top-center",
  "top-right",
  "top-left",
  "bottom-center",
  "bottom-right",
  "bottom-left",
]

export function Toaster({ viewportClassName }: ToasterProps) {
  const { toasts } = useToast()

  return (
    <>
      {positions.map((position) => {
        const positionToasts = toasts.filter((toast) => (toast.position ?? "top-center") === position)
        if (positionToasts.length === 0) {
          return null
        }

        return (
          <ToastProvider key={position}>
            {positionToasts.map(({ id, title, description, action, timeoutRef: _timeoutRef, ...props }) => (
              <Toast {...props} key={id}>
                <div className="grid gap-1">
                  {title ? <ToastTitle>{title}</ToastTitle> : null}
                  {description ? <ToastDescription>{description}</ToastDescription> : null}
                </div>
                {action}
                <ToastClose />
              </Toast>
            ))}
            <ToastViewport className={cn(viewportByPosition[position], viewportClassName)} />
          </ToastProvider>
        )
      })}
    </>
  )
}
