import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Junta classes do Tailwind sem conflito (padrão do shadcn/21st.dev).
export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}
