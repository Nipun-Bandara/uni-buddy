import { z } from 'zod'

/** Identifier accents only; surfaces continue to use the user's theme. */
export const moduleColors = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Red', value: '#ef4444' },
] as const

export const moduleSchema = z.object({
  name: z.string().trim().min(1, 'Enter a module name.'),
  code: z.string().trim().transform(value => value || undefined),
  color: z.union([z.literal(''), z.string().regex(/^#[\da-f]{6}$/i, 'Choose a color from the palette.')])
    .transform(value => value || undefined),
})
