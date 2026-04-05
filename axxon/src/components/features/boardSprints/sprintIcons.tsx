'use client';

import {
  Brain,
  Flag,
  Flame,
  Rocket,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

import {
  SPRINT_ICON_OPTIONS,
  type SprintIcon,
} from '@/lib/types/sprintTypes';

const sprintIconMap: Record<SprintIcon, LucideIcon> = {
  flag: Flag,
  rocket: Rocket,
  target: Target,
  sparkles: Sparkles,
  brain: Brain,
  flame: Flame,
};

const sprintIconLabelMap: Record<SprintIcon, string> = {
  flag: 'Flag',
  rocket: 'Rocket',
  target: 'Target',
  sparkles: 'Sparkles',
  brain: 'Brain',
  flame: 'Flame',
};

export const sprintIconOptions = SPRINT_ICON_OPTIONS.map((value) => ({
  value,
  label: sprintIconLabelMap[value],
  Icon: sprintIconMap[value],
}));

export function SprintIconGlyph({
  icon,
  className,
}: {
  icon?: SprintIcon | null;
  className?: string;
}) {
  if (!icon) {
    return null;
  }

  const Icon = sprintIconMap[icon];
  if (!Icon) {
    return null;
  }

  return <Icon className={clsx('h-4 w-4', className)} />;
}
