import { z } from 'zod'
import type { Module, WorkSession } from '@/db/types'

export const workCategorySchema = z.enum(['competitions', 'project-development', 'university-work'])
export const workCategories = [
  { value: 'competitions', label: 'Competitions' },
  { value: 'project-development', label: 'Project developments' },
  { value: 'university-work', label: 'University work' },
] as const

export function workSessionLabel(session: Pick<WorkSession, 'moduleId' | 'category'>, module?: Module) {
  return module?.name ?? workCategories.find(item => item.value === session.category)?.label ?? 'General'
}
export function workSelectionValue(session: Pick<WorkSession, 'moduleId' | 'category'>) {
  return session.moduleId ? `module:${session.moduleId}` : session.category ? `category:${session.category}` : 'general'
}
export function workSelectionFields(value: string) {
  return value.startsWith('module:') ? { moduleId: value.slice(7), category: undefined }
    : { moduleId: '', category: workCategorySchema.safeParse(value.slice(9)).data }
}
