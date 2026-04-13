'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { ProductUpdatesSection } from '@/components/admin/product-updates-section'

export default function AdminContentUpdatesPage() {
  return (
    <div className="min-w-0 bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1480px] px-5 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="space-y-3">
            <Link
              href="/admin/contingut"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Tornar a Blog i Novetats
            </Link>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Novetats
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Novetats</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Gestió de propostes, esborranys i publicació de novetats visibles al web i a l&apos;aplicació.
              </p>
            </div>
          </div>
        </header>

        <ProductUpdatesSection isSuperAdmin />
      </div>
    </div>
  )
}
