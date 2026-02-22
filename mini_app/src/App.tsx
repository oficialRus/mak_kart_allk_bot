import { useEffect } from 'react'

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        close: () => void
      }
    }
  }
}

const placeholderStyle: React.CSSProperties = {
  background: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
  color: 'var(--tg-theme-hint-color, #999)',
  border: '2px dashed #ccc',
  borderRadius: 8,
  padding: 24,
  marginBottom: 16,
  textAlign: 'center',
  minHeight: 120,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export default function App() {
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready()
      window.Telegram.WebApp.expand()
    }
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 20, textAlign: 'center' }}>🎁 Тест от психолога</h1>

      <div style={placeholderStyle}>
        <span>Тут должна быть картинка</span>
      </div>

      <div style={placeholderStyle}>
        <span>Тут должен быть ваш тест</span>
      </div>
    </div>
  )
}
