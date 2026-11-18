import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { ActivityBucket, ActivitySeries } from '@/lib/activity-chart'
import { formatInsightsDuration } from '@/lib/insights'
import { cn } from '@/lib/utils'

type Props = {
  buckets: ActivityBucket[]
  series: ActivitySeries[]
  selectedKey?: string
  onSelect: (key: string) => void
  /** Buckets starting after this instant are in the future and not selectable. */
  now: Date
  unit: 'day' | 'week'
}
const HOUR = 3_600_000
/** Narrow label for the 7-column picker, e.g. 7h08. */
function compactDuration(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60_000)
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

function ChartTooltip({ active, payload, series }: TooltipContentProps & { series: ActivitySeries[] }) {
  const bucket = payload?.[0]?.payload as ActivityBucket | undefined
  if (!active || !bucket) return null
  const rows = series.filter(item => bucket.segments[item.key])
  return <div className="max-w-60 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
    <p className="mb-2 font-medium">{bucket.title}</p>
    <p className="flex items-center gap-2"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm bg-sleep" /><span className="flex-1">Sleep</span><span className="tabular-nums">{formatInsightsDuration(bucket.sleepMs)}</span></p>
    <p className="mt-1 flex items-center gap-2 font-medium"><span aria-hidden="true" className="size-2.5 shrink-0" /><span className="flex-1">Work</span><span className="tabular-nums">{formatInsightsDuration(bucket.workMs)}</span></p>
    {rows.map(item => <p key={item.key} className="mt-1 flex items-center gap-2 text-muted-foreground"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="tabular-nums">{formatInsightsDuration(bucket.segments[item.key])}</span></p>)}
  </div>
}

/** Two bars per bucket: sleep (left) and productive time stacked by module / work type (right). */
export function ActivityChart({ buckets, series, selectedKey, onSelect, now, unit }: Props) {
  const selectable = (bucket: ActivityBucket) => bucket.start <= now
  const opacity = (bucket: ActivityBucket) => !selectedKey || bucket.key === selectedKey ? 1 : 0.35
  function select(state: { activeTooltipIndex?: number | string | null }) {
    const bucket = buckets[Number(state.activeTooltipIndex)]
    if (state.activeTooltipIndex != null && bucket && selectable(bucket)) onSelect(bucket.key)
  }
  const lastSeries = series.at(-1)?.key
  return <div className="space-y-3">
    <div aria-hidden="true" className="h-56 w-full select-none [&_.recharts-surface]:cursor-pointer [&_svg]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 4, bottom: 0, left: -20 }} barGap={2} barCategoryGap={unit === 'day' ? '18%' : '24%'} accessibilityLayer={false} onClick={select}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} interval={0} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} allowDecimals={false}
            tickFormatter={(value: number) => `${value}h`} domain={[0, 'auto']} />
          <Tooltip content={props => <ChartTooltip {...props} series={series} />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
          <Bar dataKey={(bucket: ActivityBucket) => bucket.sleepMs / HOUR} name="Sleep" stackId="sleep" fill="var(--sleep)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {buckets.map(bucket => <Cell key={bucket.key} fillOpacity={opacity(bucket)} />)}
          </Bar>
          {series.map(item => <Bar key={item.key} dataKey={(bucket: ActivityBucket) => (bucket.segments[item.key] ?? 0) / HOUR} name={item.name} stackId="work" fill={item.color}
            stroke="var(--background)" strokeWidth={1} radius={item.key === lastSeries ? [4, 4, 0, 0] : undefined} isAnimationActive={false}>
            {buckets.map(bucket => <Cell key={bucket.key} fillOpacity={opacity(bucket)} />)}
          </Bar>)}
        </BarChart>
      </ResponsiveContainer>
    </div>
    <ul aria-label="Chart legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm bg-sleep" />Sleep</li>
      {series.map(item => <li key={item.key} className="flex min-w-0 items-center gap-1.5"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} /><span className="truncate">{item.name}</span></li>)}
    </ul>
    <div role="group" aria-label={unit === 'day' ? 'Choose a day' : 'Choose a week'} className={cn('grid gap-1', unit === 'day' ? 'grid-cols-7' : 'grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))]')}>
      {buckets.map(bucket => <button key={bucket.key} type="button" disabled={!selectable(bucket)} aria-pressed={bucket.key === selectedKey}
        aria-label={`${bucket.title}: sleep ${formatInsightsDuration(bucket.sleepMs)}, work ${formatInsightsDuration(bucket.workMs)}`}
        onClick={() => onSelect(bucket.key)}
        className={cn('flex min-h-11 flex-col items-center justify-center rounded-md border px-1 text-[11px] leading-4 tabular-nums focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40',
          bucket.key === selectedKey ? 'border-primary bg-accent font-medium' : 'hover:bg-accent')}>
        <span>{bucket.label}</span><span className="text-muted-foreground">{bucket.sleepMs ? compactDuration(bucket.sleepMs) : '—'}</span>
      </button>)}
    </div>
    <p className="text-xs text-muted-foreground">Tap a bar or a {unit} above. Each button shows sleep. Work includes attended classes and completed work sessions.</p>
  </div>
}
