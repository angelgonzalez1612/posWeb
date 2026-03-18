import type { Product } from '../types'

type ProductTableProps = {
  products: Product[]
  onAdd: (product: Product) => void
}

export function ProductTable({ products, onAdd }: ProductTableProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.32)]">
      <div className="min-h-0 overflow-auto">
        <table className="min-w-full text-left">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
            <tr>
              <th className="px-5 py-4 font-semibold">Nombre</th>
              <th className="px-5 py-4 font-semibold">Categoria</th>
              <th className="px-5 py-4 font-semibold">Codigo</th>
              <th className="px-5 py-4 font-semibold">Precio</th>
              <th className="px-5 py-4 font-semibold">Tipo</th>
              <th className="px-5 py-4 font-semibold">Stock</th>
              <th className="px-5 py-4 font-semibold">Accion</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-slate-100 text-sm text-slate-600">
                <td className="px-5 py-4 font-semibold text-slate-900">{product.nombre}</td>
                <td className="px-5 py-4 text-xs text-slate-500">{product.categoria || 'General'}</td>
                <td className="px-5 py-4 font-mono text-xs text-slate-500">{product.codigo_barras}</td>
                <td className="px-5 py-4 font-semibold text-slate-900">${product.precio.toFixed(2)}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    product.tipo_venta === 'peso' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                  }`}>
                    {product.tipo_venta}
                  </span>
                </td>
                <td className="px-5 py-4">{product.stock.toFixed(product.tipo_venta === 'peso' ? 3 : 0)}</td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onAdd(product)}
                    className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    Agregar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
