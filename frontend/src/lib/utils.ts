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

// Fixed colour per cost category (colour follows the category, not its rank), led by the
// TII purple and green; the rest are validated chart hues that stay distinguishable on white.
// Charts always show the category name and share next to its colour.
export const CATEGORY_COLORS: Record<string, string> = {
  material: '#00B989',
  machine: '#6400FF',
  labor: '#eb6834',
  consumables: '#2a78d6',
  build_prep: '#eda100',
  post_process: '#e87ba4',
  part_separation: '#008300',
  heat_treatment: '#e34948',
  hip: '#4a3aa7',
  surface_treatment: '#9085e9',
  ndt: '#000000',
}

/** Shared chart chrome for the white theme */
export const CHART = {
  grid: '#e4e4e7',
  tick: '#71717a',
  legend: '#3f3f46',
  tooltip: {
    contentStyle: { backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 8 },
    labelStyle: { color: '#000000' },
    itemStyle: { color: '#3f3f46' },
  },
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
