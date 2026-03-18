import { useMemo, useState } from 'react'
import type { Product, Role, StockMovement } from '../types'

type InventoryOperation = 'entrada' | 'salida' | 'ajuste'

type InventoryTableProps = {
  products: Product[]
  movements: StockMovement[]
  role: Role
  filter: string
  onFilterChange: (value: string) => void
  saleTypeFilter: 'todos' | 'pieza' | 'peso'
  onSaleTypeFilterChange: (value: 'todos' | 'pieza' | 'peso') => void
  categoryFilter: string
  onCategoryFilterChange: (value: string) => void
  availableCategories: string[]
  onInventoryOperation: (payload: { productoId: number; tipo: InventoryOperation; cantidad?: number; nuevoStock?: number }) => Promise<void>
}

export function InventoryTable({
  products,
  movements,
  role,
  filter,
  onFilterChange,
  saleTypeFilter,
  onSaleTypeFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  availableCategories,
  onInventoryOperation,
}: InventoryTableProps) {
  const isAdmin = role === 'admin'
  const [selectedProductId, setSelectedProductId] = useState<number | ''>(products[0]?.id ?? '')
  const [operationType, setOperationType] = useState<InventoryOperation>('entrada')
  const [operationValue, setOperationValue] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState<'todos' | 'entrada' | 'salida'>('todos')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId],
  )

  const selectedProductMovements = useMemo(() => {
    const base = movements.filter((movement) => (selectedProduct ? movement.productoId === selectedProduct.id : true))
    return base.filter((movement) => (movementTypeFilter === 'todos' ? true : movement.tipo === movementTypeFilter))
  }, [movementTypeFilter, movements, selectedProduct])

  const lowStockProducts = useMemo(
    () => products.filter((product) => product.stock <= (product.tipo_venta === 'peso' ? 3 : 10)),
    [products],
  )

  const inventoryValue = useMemo(
    () => products.reduce((sum, product) => sum + product.stock * product.precio, 0),
    [products],
  )

  const totals = useMemo(
    () => ({
      products: products.length,
      low: lowStockProducts.length,
      value: inventoryValue,
      movements: movements.length,
    }),
    [inventoryValue, lowStockProducts.length, movements.length, products.length],
  )

  const handleSubmitOperation = async () => {
    if (!selectedProduct) return
    const numericValue = Number(operationValue || 0)
    if (numericValue < 0 || Number.isNaN(numericValue)) return
    if ((operationType === 'entrada' || operationType === 'salida') && numericValue <= 0) return

    setIsSubmitting(true)
    try {
      await onInventoryOperation({
        productoId: selectedProduct.id,
        tipo: operationType,
        cantidad: operationType === 'ajuste' ? undefined : numericValue,
        nuevoStock: operationType === 'ajuste' ? numericValue : undefined,
      })
      setOperationValue('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Productos visibles', value: `${totals.products}`, helper: `${totals.low} con stock bajo` },
          { label: 'Valor inventario', value: `$${totals.value.toFixed(2)}`, helper: 'Valorizacion actual del stock' },
          { label: 'Movimientos', value: `${totals.movements}`, helper: 'Entradas y salidas registradas' },
          { label: 'Producto en foco', value: selectedProduct?.nombre || 'Sin seleccionar', helper: selectedProduct ? `Stock ${selectedProduct.stock.toFixed(selectedProduct.tipo_venta === 'peso' ? 3 : 0)}` : 'Selecciona un producto' },
        ].map((item) => (
          <article key={item.label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
            <p className="mt-4 break-words text-2xl font-bold tracking-tight text-slate-950">{item.value}</p>
            <p className="mt-2 text-sm text-slate-500">{item.helper}</p>
          </article>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Inventario</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Stock disponible</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,280px)_180px_180px]">
              <input
                value={filter}
                onChange={(event) => onFilterChange(event.target.value)}
                placeholder="Filtrar por producto..."
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
              />
              <select
                value={saleTypeFilter}
                onChange={(event) => onSaleTypeFilterChange(event.target.value as 'todos' | 'pieza' | 'peso')}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
              >
                <option value="todos">Todos</option>
                <option value="pieza">Pieza</option>
                <option value="peso">Peso</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(event) => onCategoryFilterChange(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
              >
                <option value="todas">Todas</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">Producto</th>
                  <th className="px-5 py-4 font-semibold">Detalle</th>
                  <th className="px-5 py-4 font-semibold">Stock</th>
                  <th className="px-5 py-4 font-semibold">Tipo</th>
                  <th className="px-5 py-4 font-semibold">Precio</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const selected = product.id === selectedProduct?.id
                  return (
                    <tr
                      key={product.id}
                      onClick={() => setSelectedProductId(product.id)}
                      className={`cursor-pointer border-t border-slate-100 text-slate-600 transition ${selected ? 'bg-sky-50/70' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-5 py-4 font-semibold text-slate-900">{product.nombre}</td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {[product.marca, product.cantidad, product.categoria].filter(Boolean).join(' · ') || 'Sin detalle'}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{product.stock.toFixed(product.tipo_venta === 'peso' ? 3 : 0)}</td>
                      <td className="px-5 py-4 capitalize">{product.tipo_venta === 'peso' ? 'A granel' : 'Pieza'}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900">${product.precio.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          {isAdmin ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Operacion manual</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Entradas, salidas y ajustes</h3>
              <div className="mt-5 space-y-4">
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value ? Number(event.target.value) : '')}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                >
                  <option value="">Selecciona un producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.nombre}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'entrada', label: 'Entrada' },
                    { value: 'salida', label: 'Salida' },
                    { value: 'ajuste', label: 'Ajuste' },
                  ] as const).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setOperationType(item.value)}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        operationType === item.value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <input
                  value={operationValue}
                  onChange={(event) => setOperationValue(event.target.value)}
                  placeholder={
                    operationType === 'ajuste'
                      ? selectedProduct?.tipo_venta === 'peso'
                        ? 'Nuevo stock en kg'
                        : 'Nuevo stock en piezas'
                      : selectedProduct?.tipo_venta === 'peso'
                        ? 'Cantidad en kg'
                        : 'Cantidad de piezas'
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                />

                {selectedProduct ? (
                  <div className="rounded-[22px] bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">{selectedProduct.nombre}</p>
                    <p className="mt-1">Stock actual: {selectedProduct.stock.toFixed(selectedProduct.tipo_venta === 'peso' ? 3 : 0)}</p>
                    <p className="mt-1">Tipo: {selectedProduct.tipo_venta === 'peso' ? 'A granel' : 'Pieza'}</p>
                    <p className="mt-1">Precio: ${selectedProduct.precio.toFixed(2)}{selectedProduct.tipo_venta === 'peso' ? ' por kilo' : ''}</p>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleSubmitOperation()}
                  disabled={!selectedProduct || isSubmitting || operationValue.trim() === ''}
                  className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSubmitting ? 'Guardando...' : operationType === 'ajuste' ? 'Aplicar ajuste' : `Registrar ${operationType}`}
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-[28px] border border-amber-100 bg-[linear-gradient(180deg,_#fffdf7_0%,_#ffffff_100%)] p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Alerta</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Stock bajo</h3>
              </div>
              <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{lowStockProducts.length}</div>
            </div>
            <div className="mt-5 space-y-3">
              {lowStockProducts.length > 0 ? (
                lowStockProducts.slice(0, 6).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductId(product.id)}
                    className="w-full rounded-[22px] border border-amber-100 bg-amber-50/60 p-4 text-left transition hover:bg-amber-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">{product.nombre}</p>
                    <p className="mt-1 text-xs text-slate-500">{product.categoria || 'General'} · {product.tipo_venta === 'peso' ? 'A granel' : 'Pieza'}</p>
                    <p className="mt-2 text-lg font-bold tracking-tight text-amber-700">
                      {product.stock.toFixed(product.tipo_venta === 'peso' ? 3 : 0)}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No hay productos con stock bajo.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Historial</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Movimientos del producto</h3>
              </div>
              <select
                value={movementTypeFilter}
                onChange={(event) => setMovementTypeFilter(event.target.value as 'todos' | 'entrada' | 'salida')}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
              >
                <option value="todos">Todos</option>
                <option value="entrada">Entradas</option>
                <option value="salida">Salidas</option>
              </select>
            </div>
            <div className="mt-5 space-y-3">
              {selectedProductMovements.length > 0 ? (
                selectedProductMovements.slice(0, 12).map((movement) => (
                  <article key={movement.id} className="rounded-[22px] bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{selectedProduct?.nombre || `Producto #${movement.productoId}`}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{movement.tipo}</p>
                      </div>
                      <p className={`text-sm font-bold ${movement.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {movement.tipo === 'entrada' ? '+' : '-'}{movement.cantidad.toFixed(3)}
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{new Date(movement.fecha).toLocaleString()}</p>
                  </article>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No hay movimientos para el filtro actual.
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
