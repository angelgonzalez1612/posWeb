import type { Product } from '../types'
import { ProductCard } from './ProductCard'

type ProductGridProps = {
  products: Product[]
  onAdd: (product: Product) => void
  lastAddedId: number | null
}

export function ProductGrid({ products, onAdd, lastAddedId }: ProductGridProps) {
  return (
    <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAdd={onAdd} isHighlighted={lastAddedId === product.id} />
      ))}
    </section>
  )
}
