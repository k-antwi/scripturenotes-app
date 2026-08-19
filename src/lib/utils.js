import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes, last one wins on conflicts. Standard shadcn helper. */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
