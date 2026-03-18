import { useMemo, useState } from 'react'
import type { CashCut, PaymentMethod, Role, Sale, User } from '../types'

type SalesSummaryProps = {
  sales: Sale[]
  users: User[]
  role: Role
  currentUser: User
  cashCuts: CashCut[]
  onCreateCashCut: (payload: { fechaInicio: string; fechaFin: string; usuarioCierreId: number }) => Promise<void>
}

type RangeFilter = 'hoy' | 'semana' | 'mes' | 'todo'
type SortMode = 'reciente' | 'mayor' | 'menor'

const paymentLabels: Record<PaymentMethod | 'todos', string> = {
  todos: 'Todos',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

const rangeLabels: Record<RangeFilter, string> = {
  hoy: 'Hoy',
  semana: 'Semana',
  mes: 'Mes',
  todo: 'Todo',
}

function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

export function SalesSummary({ sales, users, role, currentUser, cashCuts, onCreateCashCut }: SalesSummaryProps) {
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('hoy')
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'todos'>('todos')
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('reciente')
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(sales[0]?.id ?? null)
  const [cutStart, setCutStart] = useState(() => {
    const now = new Date()
    return toLocalInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  })
  const [cutEnd, setCutEnd] = useState(() => toLocalInputValue(new Date()))
  const [isCutSaving, setIsCutSaving] = useState(false)

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const salesWithUser = useMemo(
    () =>
      sales.map((sale) => ({
        ...sale,
        usuarioNombre: users.find((user) => user.id === sale.usuarioId)?.nombre || `Usuario #${sale.usuarioId}`,
      })),
    [sales, users],
  )

  const summaryBuckets = useMemo(() => {
    const createBucket = (startDate: Date) => {
      const filtered = sales.filter((sale) => new Date(sale.fecha) >= startDate)
      return {
        total: filtered.reduce((sum, sale) => sum + sale.total, 0),
        count: filtered.length,
      }
    }

    return {
      day: createBucket(startOfDay),
      week: createBucket(startOfWeek),
      month: createBucket(startOfMonth),
    }
  }, [sales, startOfDay, startOfMonth, startOfWeek])

  const filteredSales = useMemo(() => {
    const startDate =
      rangeFilter === 'hoy'
        ? startOfDay
        : rangeFilter === 'semana'
          ? startOfWeek
          : rangeFilter === 'mes'
            ? startOfMonth
            : null

    const query = search.trim().toLowerCase()

    const filtered = salesWithUser.filter((sale) => {
      const matchesDate = startDate ? new Date(sale.fecha) >= startDate : true
      const matchesPayment = paymentFilter === 'todos' ? true : sale.metodoPago === paymentFilter
      const matchesQuery = query
        ? [
            `venta ${sale.id}`,
            String(sale.id),
            sale.usuarioNombre,
            sale.metodoPago,
            ...sale.detalles.map((detail) => detail.nombre),
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true

      return matchesDate && matchesPayment && matchesQuery
    })

    return filtered.sort((a, b) => {
      if (sortMode === 'mayor') return b.total - a.total
      if (sortMode === 'menor') return a.total - b.total
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    })
  }, [paymentFilter, rangeFilter, salesWithUser, search, sortMode, startOfDay, startOfMonth, startOfWeek])

  const filteredStats = useMemo(() => {
    const total = filteredSales.reduce((sum, sale) => sum + sale.total, 0)
    const count = filteredSales.length
    const average = count > 0 ? total / count : 0
    const items = filteredSales.reduce((sum, sale) => sum + sale.detalles.reduce((detailSum, detail) => detailSum + detail.cantidad, 0), 0)

    const paymentTotals = filteredSales.reduce<Record<PaymentMethod, number>>(
      (acc, sale) => {
        acc[sale.metodoPago] += sale.total
        return acc
      },
      { efectivo: 0, tarjeta: 0, transferencia: 0 },
    )

    return { total, count, average, items, paymentTotals }
  }, [filteredSales])

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-3">
        {[
          { label: 'Ventas del dia', value: summaryBuckets.day.total, count: summaryBuckets.day.count },
          { label: 'Ventas de la semana', value: summaryBuckets.week.total, count: summaryBuckets.week.count },
          { label: 'Ventas del mes', value: summaryBuckets.month.total, count: summaryBuckets.month.count },
        ].map((item) => (
          <article key={item.label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">${item.value.toFixed(2)}</p>
            <p className="mt-2 text-sm text-slate-500">{item.count} ventas registradas</p>
          </article>
        ))}
      </div>

      {role === 'admin' ? (
        <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Corte de caja</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Cerrar periodo</h3>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Inicio</span>
                <input
                  type="datetime-local"
                  value={cutStart}
                  onChange={(event) => setCutStart(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Fin</span>
                <input
                  type="datetime-local"
                  value={cutEnd}
                  onChange={(event) => setCutEnd(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300"
                />
              </label>
              <button
                type="button"
                onClick={async () => {
                  setIsCutSaving(true)
                  try {
                    await onCreateCashCut({
                      fechaInicio: new Date(cutStart).toISOString(),
                      fechaFin: new Date(cutEnd).toISOString(),
                      usuarioCierreId: currentUser.id,
                    })
                  } finally {
                    setIsCutSaving(false)
                  }
                }}
                disabled={isCutSaving || !cutStart || !cutEnd}
                className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isCutSaving ? 'Generando...' : 'Generar corte'}
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Historial de cortes</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Cierres registrados</h3>
            <div className="mt-5 space-y-3">
              {cashCuts.length > 0 ? (
                cashCuts.map((cut) => (
                  <article key={cut.id} className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Corte #{cut.id}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(cut.fechaInicio).toLocaleString()} a {new Date(cut.fechaFin).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{cut.usuarioCierre?.nombre || `Usuario #${cut.usuarioCierreId}`}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-bold tracking-tight text-slate-950">${cut.totalVentas.toFixed(2)}</p>
                        <p className="mt-1 text-xs text-slate-500">{cut.cantidadVentas} ventas</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Efectivo</p>
                        <p className="mt-2 font-semibold text-slate-900">${cut.totalEfectivo.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Tarjeta</p>
                        <p className="mt-2 font-semibold text-slate-900">${cut.totalTarjeta.toFixed(2)}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Transferencia</p>
                        <p className="mt-2 font-semibold text-slate-900">${cut.totalTransferencia.toFixed(2)}</p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
                  Todavia no hay cortes de caja registrados.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Centro de ventas</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Operacion comercial</h3>
            <p className="mt-2 text-sm text-slate-500">Filtra ventas, revisa tickets y encuentra productos o cajeros sin salir de la vista.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,280px)_160px_150px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por folio, producto o cajero..."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
            />
            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value as PaymentMethod | 'todos')}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
            >
              {(['todos', 'efectivo', 'tarjeta', 'transferencia'] as const).map((method) => (
                <option key={method} value={method}>
                  {paymentLabels[method]}
                </option>
              ))}
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
            >
              <option value="reciente">Mas reciente</option>
              <option value="mayor">Mayor total</option>
              <option value="menor">Menor total</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(['hoy', 'semana', 'mes', 'todo'] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setRangeFilter(range)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                rangeFilter === range ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {rangeLabels[range]}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className="space-y-3">
            {filteredSales.length > 0 ? (
              filteredSales.map((sale) => {
                const isExpanded = expandedSaleId === sale.id
                return (
                  <article key={sale.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedSaleId((current) => (current === sale.id ? null : sale.id))}
                      className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Venta #{sale.id}</p>
                        <p className="mt-1 text-sm text-slate-500">{new Date(sale.fecha).toLocaleString()}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{sale.usuarioNombre}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xl font-bold tracking-tight text-slate-950">${sale.total.toFixed(2)}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{sale.metodoPago}</p>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-500">
                        {sale.detalles.map((detail) => {
                          const quantity = Number(detail.cantidad ?? 0)
                          const price = Number(detail.precio ?? 0)
                          const subtotal = typeof detail.subtotal === 'number' ? detail.subtotal : quantity * price

                          return (
                            <div key={detail.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{detail.nombre}</p>
                                <p className="mt-1 text-xs text-slate-500">{quantity.toFixed(3)} x ${price.toFixed(2)}</p>
                              </div>
                              <p className="font-semibold text-slate-900">${subtotal.toFixed(2)}</p>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </article>
                )
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
                No hay ventas con los filtros actuales.
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Resumen filtrado</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-sm text-slate-500">Total vendido</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">${filteredStats.total.toFixed(2)}</p>
                </div>
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-sm text-slate-500">Cantidad de ventas</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{filteredStats.count}</p>
                </div>
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-sm text-slate-500">Ticket promedio</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">${filteredStats.average.toFixed(2)}</p>
                </div>
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-sm text-slate-500">Articulos / kg</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{filteredStats.items.toFixed(3)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Metodo de pago</p>
              <div className="mt-4 space-y-3">
                {(['efectivo', 'tarjeta', 'transferencia'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentFilter(method)}
                    className="flex w-full items-center justify-between rounded-[20px] bg-white px-4 py-3 text-left transition hover:bg-slate-100"
                  >
                    <span className="text-sm font-medium text-slate-600">{paymentLabels[method]}</span>
                    <span className="font-semibold text-slate-900">${filteredStats.paymentTotals[method].toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
