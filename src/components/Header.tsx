import type { Product } from '../types'

type HeaderProps = {
  barcode: string
  onBarcodeChange: (value: string) => void
  onBarcodeSubmit: () => void
  onBarcodeKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  barcodeInputRef: React.RefObject<HTMLInputElement | null>
  onOpenSearchModal: () => void
  currentCashier: string
  matchedBarcodeProduct: Product | null
  isBarcodeLookupLoading?: boolean
  onOpenStockEntryModal?: () => void
  showLogoutButton?: boolean
  onLogout?: () => void
}

export function Header({
  barcode,
  onBarcodeChange,
  onBarcodeSubmit,
  onBarcodeKeyDown,
  barcodeInputRef,
  onOpenSearchModal,
  currentCashier,
  matchedBarcodeProduct,
  isBarcodeLookupLoading = false,
  onOpenStockEntryModal,
  showLogoutButton = false,
  onLogout,
}: HeaderProps) {
  return (
    <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">Punto de Venta</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Caja principal</h2>
          <p className="mt-2 text-sm text-slate-500">Busqueda rapida por nombre o codigo de barras, optimizada para flujo continuo en mostrador.</p>
        </div>

        <div className="flex items-start gap-2">
          <div className="rounded-2xl bg-emerald-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-500">Usuario activo</p>
            <p className="mt-1 text-sm font-semibold text-emerald-900">{currentCashier}</p>
          </div>
          {onOpenStockEntryModal ? (
            <button
              type="button"
              onClick={onOpenStockEntryModal}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              Entrada stock
            </button>
          ) : null}
          {showLogoutButton && onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
            >
              Cerrar sesion
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
        <input
          ref={barcodeInputRef}
          value={barcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
          onKeyDown={onBarcodeKeyDown}
          placeholder="Escanear o capturar codigo de barras..."
          className="w-full flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:shadow-[0_16px_40px_-28px_rgba(14,165,233,0.5)] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isBarcodeLookupLoading}
        />
        <button
          type="button"
          onClick={onOpenSearchModal}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Buscar producto
        </button>
        <button type="button" onClick={onBarcodeSubmit} disabled={isBarcodeLookupLoading} className="rounded-2xl bg-sky-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300">
          {isBarcodeLookupLoading ? 'Buscando...' : 'Escanear'}
        </button>
      </div>

      {isBarcodeLookupLoading ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
          Buscando producto por codigo de barras...
        </div>
      ) : matchedBarcodeProduct ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Codigo detectado: <span className="font-semibold">{matchedBarcodeProduct.nombre}</span>. Al confirmar se agrega automaticamente al carrito.
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Atajos: <span className="font-semibold">Ctrl + B</span> buscar, <span className="font-semibold">Ctrl + Enter</span> cobrar, <span className="font-semibold">Esc</span> cerrar. El escaner funciona aunque este input no tenga foco.
        </div>
      )}
    </header>
  )
}
