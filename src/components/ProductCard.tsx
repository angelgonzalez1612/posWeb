import type { Product } from '../types'

type ProductCardProps = {
  product: Product
  onAdd: (product: Product) => void
  isHighlighted: boolean
}

export function ProductCard({ product, onAdd, isHighlighted }: ProductCardProps) {
  return (
    <article className={`rounded-[24px] border border-slate-200 bg-white p-4 ${isHighlighted ? 'ring-2 ring-emerald-300' : ''}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{product.tipo_venta}</p>
      <h3 className="mt-2 text-lg font-bold text-slate-900">{product.nombre}</h3>
      <p className="mt-2 text-sm font-mono text-slate-500">{product.codigo_barras}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">${product.precio.toFixed(2)}</p>
      <button type="button" onClick={() => onAdd(product)} className="mt-4 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white">
        Agregar
      </button>
    </article>
  )
}
