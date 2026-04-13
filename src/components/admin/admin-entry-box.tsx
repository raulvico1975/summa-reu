'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

type EntryBoxTone = 'orange' | 'blue' | 'purple' | 'emerald' | 'slate'
type EntryBoxSize = 'large' | 'small'

function toneClasses(tone: EntryBoxTone): string {
  if (tone === 'orange') return 'bg-orange-50 text-orange-600'
  if (tone === 'blue') return 'bg-blue-50 text-blue-600'
  if (tone === 'purple') return 'bg-purple-50 text-purple-600'
  if (tone === 'emerald') return 'bg-emerald-50 text-emerald-600'
  return 'bg-slate-100 text-slate-500'
}

interface SharedProps {
  title: string
  description: string
  count: number
  icon: ReactNode
  tone?: EntryBoxTone
  size?: EntryBoxSize
  lines?: string[]
}

interface LinkProps extends SharedProps {
  href: string
  onClick?: never
}

interface ButtonProps extends SharedProps {
  href?: never
  onClick: () => void
}

type AdminEntryBoxProps = LinkProps | ButtonProps

function isLinkProps(props: AdminEntryBoxProps): props is LinkProps {
  return typeof (props as LinkProps).href === 'string'
}

function BoxContent({
  title,
  description,
  count,
  icon,
  tone = 'slate',
  size = 'large',
  lines = [],
}: SharedProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses(tone)}`}>
            {icon}
          </div>
          <h3 className={`font-semibold tracking-[-0.02em] text-slate-900 ${size === 'large' ? 'text-[17px]' : 'text-[15px]'}`}>
            {title}
          </h3>
          <p className={`mt-1 text-slate-500 ${size === 'large' ? 'text-sm leading-6' : 'text-sm'}`}>{description}</p>
        </div>

        <div className="flex shrink-0 items-start gap-3">
          <span className={`font-semibold tracking-[-0.04em] text-slate-900 ${size === 'large' ? 'text-5xl' : 'text-3xl'}`}>
            {count}
          </span>
          <ChevronRight className="mt-1 h-4 w-4 text-slate-300" />
        </div>
      </div>

      {lines.length > 0 ? (
        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
          {lines.map((line) => (
            <div key={line} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}

export function AdminEntryBox(props: AdminEntryBoxProps) {
  const size = props.size ?? 'large'
  const boxClassName = [
    'block w-full rounded-[28px] border border-slate-200 bg-white text-left shadow-[0_6px_20px_rgba(15,23,42,0.04)] transition',
    'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)]',
    size === 'large' ? 'min-h-[156px] px-6 py-6' : 'min-h-[74px] px-5 py-4',
  ].join(' ')

  if (isLinkProps(props)) {
    const { href, ...shared } = props
    return (
      <Link href={href} className={boxClassName}>
        <BoxContent {...shared} />
      </Link>
    )
  }

  const { onClick, ...shared } = props
  return (
    <button type="button" onClick={onClick} className={boxClassName}>
      <BoxContent {...shared} />
    </button>
  )
}
