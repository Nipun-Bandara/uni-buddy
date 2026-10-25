import { DataSection } from '@/components/settings/data-section'
import { ModulesSection } from '@/components/settings/modules-section'
import { AcademicDatesSection } from '@/components/settings/academic-dates-section'
import { SemesterSection } from '@/components/settings/semester-section'

export function SettingsPage() {
  return (
    <section aria-labelledby="page-heading">
      <h1 id="page-heading" className="text-2xl font-semibold tracking-tight">Settings</h1>
      <SemesterSection />
      <ModulesSection />
      <AcademicDatesSection />
      <DataSection />
    </section>
  )
}
