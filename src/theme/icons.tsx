/**
 * Four hand-authored inline SVG icons. No icon library, by constraint.
 *
 * Each icon: 16x16 viewBox, 1.5px stroke, currentColor stroke and fill so
 * CSS drives color. aria-hidden — every icon button has a visible 14px text
 * label beside it (see no-icon-only-button ast-grep rule).
 */

import type { SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'aria-hidden'> & {
  /** Renders the gold-filled active state. Only meaningful for FavouriteStar. */
  active?: boolean
}

const baseProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  'aria-hidden': true,
  focusable: false,
} as const

export function FavouriteStar({ active = false, ...rest }: IconProps) {
  const fill = active ? 'var(--color-gold)' : 'none'
  const stroke = active ? 'var(--color-gold)' : 'currentColor'
  return (
    <svg {...baseProps} {...rest}>
      <path
        d="M8 1.6 9.94 5.65 14.4 6.3l-3.2 3.13.75 4.41L8 11.74 4.05 13.84l.75-4.41L1.6 6.3l4.46-.65L8 1.6z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Copy({ active: _active, ...rest }: IconProps) {
  return (
    <svg {...baseProps} {...rest}>
      <rect
        x={5}
        y={2}
        width={9}
        height={11}
        rx={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M11 13.5v.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Skip({ active: _active, ...rest }: IconProps) {
  return (
    <svg {...baseProps} {...rest}>
      <path
        d="M2 3.5 7 8 2 12.5V3.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M8 3.5 13 8 8 12.5V3.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M14 3.5v9"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Reload({ active: _active, ...rest }: IconProps) {
  return (
    <svg {...baseProps} {...rest}>
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path
        d="M13.5 2v3h-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
