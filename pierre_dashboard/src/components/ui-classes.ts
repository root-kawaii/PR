export const joinClasses = (
  ...classes: Array<string | false | null | undefined>
) => classes.filter(Boolean).join(' ');

export const ui = {
  pageHeader: 'mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
  pageTitle: 'text-2xl font-bold tracking-tight text-balance text-gray-900',
  pageDescription: 'max-w-2xl text-sm leading-6 text-pretty text-gray-500',
  backLink:
    'inline-flex items-center gap-1.5 rounded-lg text-sm text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15',
  primaryButton:
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-50',
  secondaryButton:
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50',
  iconButton:
    'inline-flex size-10 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10',
  card:
    'rounded-2xl border border-gray-200 bg-white shadow-[0_0_0_1px_rgba(17,24,39,0.03),0_10px_24px_rgba(17,24,39,0.05)]',
  cardInset:
    'rounded-xl border border-gray-200 bg-gray-50/80',
  input:
    'w-full min-h-10 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-[border-color,box-shadow,background-color] focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10',
  textarea:
    'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-[border-color,box-shadow,background-color] focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10',
  select:
    'min-h-10 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 pr-9 text-sm text-gray-900 outline-none transition-[border-color,box-shadow,background-color] focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50 appearance-none',
  label: 'mb-1.5 block text-sm font-medium text-gray-700',
  helperText: 'text-sm leading-6 text-pretty text-gray-500',
  modalOverlay: 'fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4',
  modalPanel:
    'w-full max-w-lg overflow-y-auto rounded-[28px] border border-gray-200 bg-white p-6 shadow-2xl max-h-[90vh]',
  tableWrap: 'overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_0_0_1px_rgba(17,24,39,0.03),0_10px_24px_rgba(17,24,39,0.05)]',
  tableHeader:
    'bg-gray-50/90 border-b border-gray-200 text-left px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500',
  tableCell: 'px-5 py-4 align-top text-sm text-gray-600',
  tableRow: 'transition-colors hover:bg-gray-50/80',
  emptyState: 'rounded-2xl border border-dashed border-gray-300 bg-white/80 px-6 py-10 text-center',
  statusPill: 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
  tabularNums: 'tabular-nums',
};
