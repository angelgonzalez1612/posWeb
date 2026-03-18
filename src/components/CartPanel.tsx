import type { CartItem } from '../types'

type CartPanelProps = {
  items: CartItem[]
  onIncrease: (productId: number) => void
  onDecrease: (productId: number) => void
  onRemove: (productId: number) => void
  onWeightValueChange: (productId: number, value: number) => void
  onWeightPresetSelect: (productId: number, value: number) => void
  onCheckout: () => void
}

const TAX_RATE = 0.16
const weightPresets = [
  { label: '1/4 (250 g)', value: 250 },
  { label: '1/2 (500 g)', value: 500 },
]

export function CartPanel({
  items,
  onIncrease,
  onDecrease,
  onRemove,
  onWeightValueChange,
  onWeightPresetSelect,
  onCheckout,
}: CartPanelProps) {
  const subtotal = items.reduce((sum, item) => sum + item.precio * item.quantity, 0)
  const taxes = subtotal * TAX_RATE
  const total = subtotal + taxes

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Carrito</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Compra actual</h3>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">{items.length} items</div>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-semibold text-slate-700">El carrito esta vacio</p>
            <p className="mt-2 text-sm text-slate-500">Escanea un codigo o agrega productos desde la tabla para preparar la venta.</p>
          </div>
        ) : (
          items.map((item) => (
            <article key={item.productId} className="animate-cart-entry rounded-[18px] border border-slate-100 bg-slate-50 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-slate-900">{item.nombre}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.productId)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold leading-none text-rose-500 transition hover:bg-rose-50"
                  aria-label={`Eliminar ${item.nombre}`}
                  title="Eliminar"
                >
                  ×
                </button>
              </div>

              {item.tipo_venta === 'peso' ? (
                <div className="mt-2 rounded-xl bg-white p-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.weightValue}
                      onChange={(event) => onWeightValueChange(item.productId, Number(event.target.value))}
                      className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-sky-300"
                      placeholder="Gramos"
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">g</span>
                    <span className="ml-auto text-sm font-bold text-slate-900">${(item.precio * item.quantity).toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {weightPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => onWeightPresetSelect(item.productId, preset.value)}
                        className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-white p-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDecrease(item.productId)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="min-w-7 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onIncrease(item.productId)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-sm font-semibold text-white transition hover:bg-sky-700"
                    >
                      +
                    </button>
                  </div>
                  <span className="pr-1 text-sm font-bold text-slate-900">${(item.precio * item.quantity).toFixed(2)}</span>
                </div>
              )}

              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>${item.precio.toFixed(2)} {item.tipo_venta === 'peso' ? 'por kg' : 'c/u'}</span>
                <span className="font-semibold text-slate-700">Precio</span>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mt-5 space-y-3 rounded-[24px] bg-slate-50 p-4">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Subtotal</span>
          <span className="font-semibold text-slate-800">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Impuestos</span>
          <span className="font-semibold text-slate-800">${taxes.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Total</span>
          <span className="text-2xl font-bold tracking-tight text-slate-950">${total.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        className="mt-5 rounded-[24px] bg-emerald-500 px-4 py-4 text-base font-bold uppercase tracking-[0.2em] text-white shadow-[0_24px_50px_-26px_rgba(16,185,129,0.7)] transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
        disabled={items.length === 0}
      >
        Cobrar
      </button>
    </aside>
  )
}
