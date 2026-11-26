// Register only production builds. A waiting worker is activated explicitly
// from the setup screen, so a new deployment cannot reload an active round.
export function watchForUpdate(onUpdate: (worker: ServiceWorker) => void): () => void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return () => {}

  let disposed = false
  let registration: ServiceWorkerRegistration | undefined

  function notify(): void {
    if (!disposed && registration?.waiting && navigator.serviceWorker.controller) {
      onUpdate(registration.waiting)
    }
  }

  function onUpdateFound(): void {
    const worker = registration?.installing
    worker?.addEventListener('statechange', notify)
  }

  void navigator.serviceWorker
    .register(new URL('sw.js', document.baseURI))
    .then((reg) => {
      if (disposed) return
      registration = reg
      registration.addEventListener('updatefound', onUpdateFound)
      onUpdateFound()
      notify()
      return registration.update()
    })
    .catch(() => {
      // Browsers without working service-worker storage can still play online.
    })

  return () => {
    disposed = true
    registration?.removeEventListener('updatefound', onUpdateFound)
  }
}

export function applyUpdate(worker: ServiceWorker): void {
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => window.location.reload(),
    { once: true },
  )
  worker.postMessage({ type: 'SKIP_WAITING' })
}
