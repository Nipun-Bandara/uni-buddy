import { useSearchParams } from 'react-router'
import { AcademicCalendar } from '@/components/academic/academic-calendar'
import { TimetableRules } from '@/components/schedule/timetable-rules'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function SchedulePage() {
  const [params, setParams] = useSearchParams()
  return <section aria-labelledby="page-heading">
    <h1 id="page-heading" className="text-2xl font-semibold tracking-tight">Schedule</h1>
    <Tabs value={params.get('view') === 'calendar' ? 'dates' : 'classes'} onValueChange={value => setParams(value === 'dates' ? { view: 'calendar' } : {}, { replace: true })} className="mt-6">
      <TabsList className="h-11 w-full">
        <TabsTrigger value="classes" className="min-h-10 flex-1">Classes</TabsTrigger>
        <TabsTrigger value="dates" className="min-h-10 flex-1">Academic calendar</TabsTrigger>
      </TabsList>
      <TabsContent value="classes"><TimetableRules /></TabsContent>
      <TabsContent value="dates"><AcademicCalendar /></TabsContent>
    </Tabs>
  </section>
}
