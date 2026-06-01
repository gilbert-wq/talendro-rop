import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <Header
        sidebarCollapsed={collapsed}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(d => !d)}
      />
      <main
        className={cn(
          "transition-all duration-300 pt-14 min-h-screen",
          collapsed ? "pl-16" : "pl-[260px]"
        )}
      >
        <div className="p-6 animate-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
