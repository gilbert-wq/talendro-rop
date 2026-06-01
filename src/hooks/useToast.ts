import { useState, useCallback } from 'react'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

let toastListeners: ((toasts: Toast[]) => void)[] = []
let toastState: Toast[] = []

function notifyListeners() {
  toastListeners.forEach(fn => fn([...toastState]))
}

export function addToast(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  toastState = [...toastState, { ...toast, id }]
  notifyListeners()
  setTimeout(() => {
    toastState = toastState.filter(t => t.id !== id)
    notifyListeners()
  }, 4000)
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  
  useState(() => {
    toastListeners.push(setToasts)
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== setToasts)
    }
  })

  const dismiss = useCallback((id: string) => {
    toastState = toastState.filter(t => t.id !== id)
    notifyListeners()
  }, [])

  return { toasts, dismiss }
}

export function useToast() {
  const toast = useCallback((params: Omit<Toast, 'id'>) => {
    addToast(params)
  }, [])
  return { toast }
}
