let audio: AudioContext | undefined

export function playSound(enabled: boolean, kind: 'start' | 'next' | 'end'): void {
  if (!enabled) return
  try {
    audio ??= new AudioContext()
    const context = audio
    void context.resume().then(() => {
      const now = context.currentTime
      const notes = kind === 'start' ? [440, 660] : kind === 'end' ? [660, 440] : [520]
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const time = now + index * 0.11
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0.001, time)
        gain.gain.exponentialRampToValueAtTime(0.045, time + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.10)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(time)
        oscillator.stop(time + 0.11)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      })
    }).catch(() => {})
  } catch { /* audio optional, including unsupported browsers */ }
}
