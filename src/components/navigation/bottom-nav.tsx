import { CalendarDays, ChartNoAxesColumn, Clock3, House } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

const links = [
  { to: '/', label: 'Today', icon: House },
  { to: '/sessions', label: 'Sessions', icon: Clock3 },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/insights', label: 'Insights', icon: ChartNoAxesColumn },
]

export function BottomNav() {
  return (
    <nav aria-label="Main navigation" className="grid shrink-0 grid-cols-4 border-t bg-background pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn(
          'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs focus-visible:outline-2 focus-visible:outline-ring',
          isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent',
        )}>
          <Icon size={20} aria-hidden="true" />{label}
        </NavLink>
      ))}
    </nav>
  )
}
