// Switches between list, kanban, and calendar board views using the shared segmented control pattern.
'use client'

import type { ReactNode } from 'react'
import { CalendarDays, Columns3, Rows3 } from 'lucide-react'
import SegmentedControl from '@/components/ui/SegmentedControl'

import type { BoardDisplayView } from '@/lib/types/boardViewTypes'

const viewOptions: Array<{ value: BoardDisplayView; label: string; icon: ReactNode }> = [
  { value: 'list', label: 'List', icon: <Rows3 className="h-4 w-4" /> },
  { value: 'kanban', label: 'Kanban', icon: <Columns3 className="h-4 w-4" /> },
  { value: 'calendar', label: 'Calendar', icon: <CalendarDays className="h-4 w-4" /> },
]

export default function BoardViewSwitcher({
  activeView,
  onChangeView,
}: {
  activeView: BoardDisplayView
  onChangeView: (view: BoardDisplayView) => void
}) {
  return (
    <SegmentedControl
      value={activeView}
      onChange={onChangeView}
      options={viewOptions}
      ariaLabel="Board views"
    />
  )
}
