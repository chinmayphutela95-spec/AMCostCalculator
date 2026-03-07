import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export const CATEGORY_COLORS: Record<string, string> = {
  material: '#3b82f6',
  machine: '#8b5cf6',
  labor: '#f59e0b',
  consumables: '#06b6d4',
  build_prep: '#10b981',
  post_process: '#f97316',
  heat_treatment: '#ec4899',
  part_separation: '#84cc16',
  hip: '#6366f1',
  surface_treatment: '#14b8a6',
  ndt: '#e879f9',
}

export const CATEGORY_LABELS: Record<string, string> = {
  material: 'Material',
  machine: 'Machine',
  labor: 'Labor',
  consumables: 'Consumables',
  build_prep: 'Build Prep',
  post_process: 'Post-Process',
  heat_treatment: 'Heat Treatment',
  part_separation: 'Part Separation',
  hip: 'HIP',
  surface_treatment: 'Surface Treatment',
  ndt: 'NDT / Inspection',
}
