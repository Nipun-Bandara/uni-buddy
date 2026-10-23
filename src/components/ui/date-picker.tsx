import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { parseCalendarDate, toCalendarDate } from '@/lib/dates'

type DatePickerProps = {
  id: string
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  defaultDate?: string
}

export function DatePicker({ id, name, label, value, onChange, disabled, invalid, describedBy, defaultDate }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [today] = useState(() => new Date())
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button id={id} name={name} type="button" variant="outline" disabled={disabled}
        className="min-h-11 w-full justify-between text-base font-normal"
        aria-invalid={invalid} aria-describedby={describedBy}>
        {value ? format(parseCalendarDate(value), 'd MMM yyyy') : 'Choose a date'}
        <CalendarDays aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" aria-label={`Choose ${label.toLowerCase()}`}>
      <Calendar mode="single" required captionLayout="dropdown" autoFocus
        className="mx-auto [--cell-size:2.25rem]"
        selected={value ? parseCalendarDate(value) : undefined}
        defaultMonth={value ? parseCalendarDate(value) : defaultDate ? parseCalendarDate(defaultDate) : today}
        startMonth={new Date(1900, 0)} endMonth={new Date(2100, 11)} disabled={disabled}
        onSelect={date => { if (date) { onChange(toCalendarDate(date)); setOpen(false) } }} />
    </PopoverContent>
  </Popover>
}
