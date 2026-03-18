import { useRef, useState } from 'react'
import type { Product, ProductLookupResult, SaleType } from '../types'

type CreationMode = 'barcode' | 'manual'
const SYSTEM_CATEGORIES = [
  'Agua',
  'Bebidas',
  'Pan',
  'Dulces',
  'Botanas',
  'Galletas',
  'Lacteos',
  'Embutidos',
  'Abarrotes',
  'Cereales',
  'Despensa',
  'Jugos',
  'General',
] as const

type ProductsManagerProps = {
  products: Product[]
  onCreate: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void> | void
  onUpdate: (productId: number, payload: Partial<Omit<Product, 'id' | 'createdAt'>>) => Promise<void> | void
  onDelete: (productId: number) => Promise<void> | void
  onLookupByBarcode: (barcode: string) => Promise<ProductLookupResult>
  onOpenInventoryProduct: (product: { nombre: string; codigo_barras: string }) => void
  onGenerateBarcodePdf: (productIds: number[], copies: number) => Promise<void> | void
}

export function ProductsManager({ products, onCreate, onUpdate, onDelete, onLookupByBarcode, onOpenInventoryProduct, onGenerateBarcodePdf }: ProductsManagerProps) {
  const emptyForm = {
    nombre: '',
    codigo_barras: '',
    marca: '',
    cantidad: '',
    categoria: '',
    precio: '0',
    tipo_venta: 'pieza' as SaleType,
  }
  const [form, setForm] = useState({
    ...emptyForm,
  })
  const [categorySelection, setCategorySelection] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [creationMode, setCreationMode] = useState<CreationMode>('barcode')
  const [listFilter, setListFilter] = useState('')
  const [listCategoryFilter, setListCategoryFilter] = useState('todas')
  const [listSaleTypeFilter, setListSaleTypeFilter] = useState<'todos' | 'pieza' | 'peso'>('todos')
  const [listBarcodeFilter, setListBarcodeFilter] = useState<'todos' | 'interno' | 'comercial'>('todos')
  const [lookupMeta, setLookupMeta] = useState<{ message: string; tone: 'neutral' | 'success' | 'warning' } | null>(null)
  const [lookupResult, setLookupResult] = useState<ProductLookupResult | null>(null)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [productPendingDelete, setProductPendingDelete] = useState<Product | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [barcodePdfModal, setBarcodePdfModal] = useState<{ productIds: number[]; copies: string } | null>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const priceInputRef = useRef<HTMLInputElement>(null)
  const categoryOptions: string[] = [...SYSTEM_CATEGORIES]
  const isInternalBarcode = (barcode: string) => /^29\d{10}$/.test(barcode)
  const filteredProducts = products.filter((product) => {
    const haystack = [product.nombre, product.codigo_barras, product.marca, product.cantidad, product.categoria].filter(Boolean).join(' ').toLowerCase()
    const matchesText = listFilter ? haystack.includes(listFilter.toLowerCase()) : true
    const matchesCategory = listCategoryFilter === 'todas' ? true : (product.categoria || 'General') === listCategoryFilter
    const matchesSaleType = listSaleTypeFilter === 'todos' ? true : product.tipo_venta === listSaleTypeFilter
    const internalBarcode = isInternalBarcode(product.codigo_barras)
    const matchesBarcodeType =
      listBarcodeFilter === 'todos'
        ? true
        : listBarcodeFilter === 'interno'
          ? internalBarcode
          : !internalBarcode
    return matchesText && matchesCategory && matchesSaleType && matchesBarcodeType
  })
  const filteredInternalProducts = filteredProducts.filter((product) => isInternalBarcode(product.codigo_barras))

  const resetProductForm = () => {
    setForm({ ...emptyForm })
    setCategorySelection('')
    setCustomCategory('')
    setLookupMeta(null)
    setLookupResult(null)
    setEditingProductId(null)
  }

  const startEditingProduct = (product: Product) => {
    setCreationMode('manual')
    setForm({
      nombre: product.nombre,
      codigo_barras: product.codigo_barras,
      marca: product.marca || '',
      cantidad: product.cantidad || '',
      categoria: product.categoria || '',
      precio: String(product.precio),
      tipo_venta: product.tipo_venta,
    })
    syncCategoryState(product.categoria || '')
    setLookupResult({
      id: product.id,
      nombre: product.nombre,
      codigo_barras: product.codigo_barras,
      marca: product.marca || '',
      cantidad: product.cantidad || '',
      categoria: product.categoria || '',
      tipo_venta: product.tipo_venta,
      precio: product.precio,
      stock: product.stock,
      existsInCatalog: true,
      source: 'catalogo-local',
    })
    setEditingProductId(product.id)
    setLookupMeta({
      message: 'Producto cargado para editar.',
      tone: 'neutral',
    })
    window.setTimeout(() => priceInputRef.current?.focus(), 0)
  }

  const syncCategoryState = (nextCategory: string) => {
    const normalized = nextCategory.trim()
    if (!normalized) {
      setCategorySelection('')
      setCustomCategory('')
      return
    }

    if (categoryOptions.includes(normalized)) {
      setCategorySelection(normalized)
      setCustomCategory('')
      return
    }

    setCategorySelection('Otra')
    setCustomCategory(normalized)
  }

  const buildNextInternalBarcode = () => {
    const manualProducts = products
      .map((product) => product.codigo_barras)
      .filter((barcode) => /^29\d{10}$/.test(barcode))
      .map((barcode) => Number(barcode.slice(2)))

    const nextSequence = (manualProducts.length ? Math.max(...manualProducts) : 0) + 1
    return `29${String(nextSequence).padStart(10, '0')}`
  }

  const handleLookup = async () => {
    if (!form.codigo_barras.trim()) {
      setLookupMeta({ message: 'Captura un codigo de barras para consultar.', tone: 'warning' })
      return
    }

    setIsLookingUp(true)
    try {
      const result = await onLookupByBarcode(form.codigo_barras)
      setLookupResult(result)
      setEditingProductId(result.existsInCatalog ? result.id ?? null : null)
      setForm((current) => ({
        ...current,
        nombre: result.nombre || current.nombre,
        codigo_barras: result.codigo_barras || current.codigo_barras,
        marca: result.marca || current.marca,
        cantidad: result.cantidad || current.cantidad,
        categoria: result.categoria || current.categoria,
        precio: String(result.precio ?? 0),
        tipo_venta: 'pieza',
      }))
      syncCategoryState(result.categoria || '')
      setLookupMeta({
        message: result.existsInCatalog
          ? 'Ya existe en catalogo.'
          : `Producto encontrado${result.marca ? `: ${result.marca}` : ''}.`,
        tone: result.existsInCatalog ? 'warning' : 'success',
      })
      window.setTimeout(() => priceInputRef.current?.focus(), 0)
    } catch (error) {
      setLookupResult(null)
      setEditingProductId(null)
      setLookupMeta({
        message: error instanceof Error ? error.message : 'Producto no encontrado.',
        tone: 'warning',
      })
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleCreate = async () => {
    setIsSaving(true)
    try {
      const internalBarcode = creationMode === 'manual' && !form.codigo_barras ? buildNextInternalBarcode() : form.codigo_barras

      if (editingProductId) {
        await onUpdate(editingProductId, {
          nombre: form.nombre,
          codigo_barras: internalBarcode,
          marca: form.marca,
          cantidad: form.cantidad,
          categoria: form.categoria,
          precio: Number(form.precio),
          tipo_venta: form.tipo_venta,
        })
        setLookupMeta({ message: 'Producto actualizado correctamente.', tone: 'success' })
      } else {
        await onCreate({
          nombre: form.nombre,
          codigo_barras: internalBarcode,
          marca: form.marca,
          cantidad: form.cantidad,
          categoria: form.categoria,
          precio: Number(form.precio),
          tipo_venta: form.tipo_venta,
          stock: 0,
        })
        setLookupMeta({ message: 'Producto guardado correctamente.', tone: 'success' })
      }
      resetProductForm()
      window.setTimeout(() => barcodeInputRef.current?.focus(), 0)
    } catch (error) {
      setLookupMeta({
        message: error instanceof Error ? error.message : 'No fue posible guardar el producto.',
        tone: 'warning',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Catalogo</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{editingProductId ? 'Editar producto' : 'Crear producto'}</h3>
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-[24px] bg-slate-100 p-1">
          {([
            { value: 'barcode', label: 'Codigo de barras' },
            { value: 'manual', label: 'Nuevo sin codigo' },
          ] as const).map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => {
                setCreationMode(mode.value)
                resetProductForm()
                window.setTimeout(() => barcodeInputRef.current?.focus(), 0)
              }}
              className={`rounded-[20px] px-4 py-3 text-sm font-semibold transition ${
                creationMode === mode.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="relative mt-5 space-y-4">
          {creationMode === 'barcode' && isLookingUp ? (
            <div className="absolute inset-0 z-10 rounded-[24px] bg-white/75 backdrop-blur-[1px]">
              <div className="space-y-4 p-1">
                <div className="h-[86px] animate-pulse rounded-[20px] bg-slate-100" />
                <div className="h-[82px] animate-pulse rounded-[20px] bg-slate-100" />
                <div className="h-[82px] animate-pulse rounded-[20px] bg-slate-100" />
                <div className="h-[92px] animate-pulse rounded-[20px] bg-slate-100" />
              </div>
            </div>
          ) : null}

          {creationMode === 'barcode' ? (
            <>
              <div>
                <label className="block">
                  <p className="mb-2 text-sm font-semibold text-slate-700">Codigo de barras</p>
                  <div className="flex gap-3">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={form.codigo_barras}
                      onChange={(event) => {
                        const nextBarcode = event.target.value
                        setForm((current) => {
                          if (current.codigo_barras === nextBarcode) {
                            return current
                          }

                          return {
                            ...emptyForm,
                            codigo_barras: nextBarcode,
                          }
                        })
                        setLookupResult(null)
                        setEditingProductId(null)
                        if (lookupMeta) {
                          setLookupMeta(null)
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleLookup()
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                      placeholder="Escanea o captura el codigo..."
                    />
                    <button
                      type="button"
                      onClick={() => void handleLookup()}
                      disabled={isLookingUp}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {isLookingUp ? '...' : 'Consultar'}
                    </button>
                  </div>
                </label>
              </div>
              <Field label="Nombre" value={form.nombre} onChange={(value) => setForm((current) => ({ ...current, nombre: value }))} disabled={isLookingUp} />
              <Field label="Marca" value={form.marca} onChange={(value) => setForm((current) => ({ ...current, marca: value }))} disabled={isLookingUp} />
              <Field label="Contenido / gramaje" value={form.cantidad} onChange={(value) => setForm((current) => ({ ...current, cantidad: value }))} disabled={isLookingUp} />
              <CategoryField
                value={form.categoria}
                categoryOptions={categoryOptions}
                selectedValue={categorySelection}
                customValue={customCategory}
                onSelectChange={(value) => {
                  setCategorySelection(value)
                  if (value === 'Otra') {
                    setForm((current) => ({ ...current, categoria: customCategory }))
                    return
                  }
                  setCustomCategory('')
                  setForm((current) => ({ ...current, categoria: value }))
                }}
                onCustomChange={(value) => {
                  setCustomCategory(value)
                  setForm((current) => ({ ...current, categoria: value }))
                }}
                disabled={isLookingUp}
              />
              <Field label="Precio" value={form.precio} onChange={(value) => setForm((current) => ({ ...current, precio: value }))} type="number" inputRef={priceInputRef} disabled={isLookingUp} />
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Tipo de venta asignado automaticamente: <span className="font-semibold text-slate-900">pieza</span>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {editingProductId
                  ? 'Edita la informacion del producto y guarda los cambios.'
                  : 'Se generara un codigo interno automaticamente para imprimir y pegar en el contenedor.'}
              </div>
              {!editingProductId ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Modo del producto</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'pieza', label: 'Por pieza' },
                      { value: 'peso', label: 'A granel' },
                    ] as const).map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, tipo_venta: type.value }))}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                          form.tipo_venta === type.value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <Field label="Nombre" value={form.nombre} onChange={(value) => setForm((current) => ({ ...current, nombre: value }))} />
              {editingProductId ? (
                <>
                  <Field label="Marca" value={form.marca} onChange={(value) => setForm((current) => ({ ...current, marca: value }))} />
                  <Field label="Contenido / gramaje" value={form.cantidad} onChange={(value) => setForm((current) => ({ ...current, cantidad: value }))} />
                </>
              ) : null}
              <CategoryField
                value={form.categoria}
                categoryOptions={categoryOptions}
                selectedValue={categorySelection}
                customValue={customCategory}
                onSelectChange={(value) => {
                  setCategorySelection(value)
                  if (value === 'Otra') {
                    setForm((current) => ({ ...current, categoria: customCategory }))
                    return
                  }
                  setCustomCategory('')
                  setForm((current) => ({ ...current, categoria: value }))
                }}
                onCustomChange={(value) => {
                  setCustomCategory(value)
                  setForm((current) => ({ ...current, categoria: value }))
                }}
              />
              <Field
                label={form.tipo_venta === 'peso' ? 'Precio por kilo' : 'Precio'}
                value={form.precio}
                onChange={(value) => setForm((current) => ({ ...current, precio: value }))}
                type="number"
                inputRef={priceInputRef}
              />
              {editingProductId ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Modo del producto</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'pieza', label: 'Por pieza' },
                      { value: 'peso', label: 'A granel' },
                    ] as const).map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, tipo_venta: type.value }))}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold capitalize transition ${
                          form.tipo_venta === type.value ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
          {lookupMeta ? (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                lookupMeta.tone === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : lookupMeta.tone === 'warning'
                    ? 'border border-amber-200 bg-amber-50 text-amber-700'
                    : 'border border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {lookupMeta.message}
            </div>
          ) : null}
          {lookupResult && creationMode === 'barcode' && !isLookingUp ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Detalle detectado</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{lookupResult.nombre || 'Sin nombre detectado'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lookupResult.marca ? <InfoChip label="Marca" value={lookupResult.marca} /> : null}
                  {lookupResult.cantidad ? <InfoChip label="Contenido" value={lookupResult.cantidad} /> : null}
                  {lookupResult.categoria ? <InfoChip label="Categoria" value={lookupResult.categoria} /> : null}
                </div>
                {lookupResult.descripcion ? (
                  <p className="text-sm leading-6 text-slate-600">{lookupResult.descripcion}</p>
                ) : null}
                <p className="text-xs text-slate-400">Fuente: {lookupResult.source}</p>
              </div>
            </div>
          ) : null}
          {lookupResult?.existsInCatalog && editingProductId ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => window.setTimeout(() => priceInputRef.current?.focus(), 0)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Editar producto
              </button>
              <button
                type="button"
                onClick={() => onOpenInventoryProduct({ nombre: lookupResult.nombre, codigo_barras: lookupResult.codigo_barras })}
                className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
              >
                Ir a inventario
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isSaving || (creationMode === 'barcode' && isLookingUp)}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {isSaving ? 'Guardando...' : editingProductId ? 'Actualizar producto' : 'Guardar producto'}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Gestion</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Lista completa</h3>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_170px_190px]">
          <input
            value={listFilter}
            onChange={(event) => setListFilter(event.target.value)}
            placeholder="Filtrar por nombre, codigo, marca..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
          />
          <select
            value={listCategoryFilter}
            onChange={(event) => setListCategoryFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
          >
            <option value="todas">Todas las categorias</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={listSaleTypeFilter}
            onChange={(event) => setListSaleTypeFilter(event.target.value as 'todos' | 'pieza' | 'peso')}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
          >
            <option value="todos">Todos los tipos</option>
            <option value="pieza">Pieza</option>
            <option value="peso">Peso</option>
          </select>
          <select
            value={listBarcodeFilter}
            onChange={(event) => setListBarcodeFilter(event.target.value as 'todos' | 'interno' | 'comercial')}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
          >
            <option value="todos">Todos los codigos</option>
            <option value="interno">Codigo interno</option>
            <option value="comercial">Codigo comercial</option>
          </select>
        </div>
        <div className="mt-4 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          El boton <span className="font-semibold">PDF codigo</span> solo aparece en productos con codigo interno del sistema
          <span className="font-mono font-semibold"> 29...</span>. Usa el filtro <span className="font-semibold">Codigo interno</span> para verlos rapido.
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Etiquetas por lote</p>
            <p className="mt-1 text-sm text-slate-500">{selectedProductIds.length} seleccionados para imprimir.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedProductIds(filteredInternalProducts.map((product) => product.id))}
              disabled={filteredInternalProducts.length === 0}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Seleccionar visibles
            </button>
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              disabled={selectedProductIds.length === 0}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Limpiar
            </button>
              <button
                type="button"
                onClick={() => setBarcodePdfModal({ productIds: selectedProductIds, copies: '1' })}
                disabled={selectedProductIds.length === 0}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Generar PDF seleccionados
            </button>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {filteredProducts.map((product) => (
            <article key={product.id} className="grid gap-3 rounded-[24px] bg-slate-50 p-4 xl:grid-cols-[minmax(0,1fr)_160px_160px] xl:items-center">
              <div>
                {isInternalBarcode(product.codigo_barras) ? (
                  <label className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product.id)}
                      onChange={(event) => {
                        setSelectedProductIds((current) =>
                          event.target.checked ? Array.from(new Set([...current, product.id])) : current.filter((id) => id !== product.id),
                        )
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Seleccionar etiqueta
                  </label>
                ) : null}
                <p className="text-sm font-semibold text-slate-900">{product.nombre}</p>
                <p className="mt-1 text-xs font-mono text-slate-500">{product.codigo_barras}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {isInternalBarcode(product.codigo_barras) ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      Codigo interno
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Codigo comercial
                    </span>
                  )}
                  <span className="rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
                    {product.tipo_venta === 'peso' ? 'A granel' : 'Por pieza'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {[product.marca, product.cantidad, product.categoria].filter(Boolean).join(' · ') || 'Sin detalle extra'}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Resumen</p>
                <p className="mt-2 font-semibold text-slate-900">${product.precio.toFixed(2)}</p>
                <p className="mt-1 text-xs capitalize text-slate-500">{product.tipo_venta === 'peso' ? 'A granel' : 'Por pieza'}</p>
              </div>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => startEditingProduct(product)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Editar
                </button>
                {isInternalBarcode(product.codigo_barras) ? (
                  <button
                    type="button"
                    onClick={() => setBarcodePdfModal({ productIds: [product.id], copies: '1' })}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    PDF codigo
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setProductPendingDelete(product)}
                  className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
          {filteredProducts.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No hay productos que coincidan con los filtros actuales.
            </div>
          ) : null}
        </div>
      </section>

      {productPendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_40px_90px_-50px_rgba(15,23,42,0.45)]">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Confirmar eliminacion</p>
            <h4 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">¿Seguro que quieres eliminar este producto?</h4>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Se eliminara <span className="font-semibold text-slate-900">{productPendingDelete.nombre}</span> del catalogo.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setProductPendingDelete(null)}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void onDelete(productPendingDelete.id)
                  setProductPendingDelete(null)
                }}
                className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Si, eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {barcodePdfModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_40px_90px_-50px_rgba(15,23,42,0.45)]">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Etiquetas</p>
            <h4 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Generar PDF de codigos</h4>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Se generaran etiquetas para <span className="font-semibold text-slate-900">{barcodePdfModal.productIds.length}</span> producto(s).
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Copias por producto</span>
              <input
                type="number"
                min="1"
                max="50"
                value={barcodePdfModal.copies}
                onChange={(event) => setBarcodePdfModal((current) => (current ? { ...current, copies: event.target.value } : current))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
              />
            </label>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setBarcodePdfModal(null)}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const copies = Math.min(Math.max(Number(barcodePdfModal.copies) || 1, 1), 50)
                  void onGenerateBarcodePdf(barcodePdfModal.productIds, copies)
                  setBarcodePdfModal(null)
                }}
                className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Generar PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type InfoChipProps = {
  label: string
  value: string
}

function InfoChip({ label, value }: InfoChipProps) {
  return (
    <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
      <span className="font-semibold text-slate-800">{label}:</span> {value}
    </div>
  )
}

type CategoryFieldProps = {
  value: string
  categoryOptions: string[]
  selectedValue: string
  customValue: string
  onSelectChange: (value: string) => void
  onCustomChange: (value: string) => void
  disabled?: boolean
}

function CategoryField({
  value,
  categoryOptions,
  selectedValue,
  customValue,
  onSelectChange,
  onCustomChange,
  disabled = false,
}: CategoryFieldProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">Categoria</p>
      <select
        value={selectedValue || (value && !categoryOptions.includes(value) ? 'Otra' : '')}
        onChange={(event) => onSelectChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">Selecciona una categoria</option>
        {categoryOptions.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
        <option value="Otra">Otra</option>
      </select>
      {(selectedValue === 'Otra' || (value && !categoryOptions.includes(value) && !selectedValue)) ? (
        <input
          type="text"
          value={customValue}
          onChange={(event) => onCustomChange(event.target.value)}
          disabled={disabled}
          placeholder="Nueva categoria..."
          className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
      ) : null}
    </div>
  )
}

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number'
  compact?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  disabled?: boolean
}

function Field({ label, value, onChange, type = 'text', compact = false, inputRef, disabled = false }: FieldProps) {
  return (
    <label className="block">
      <p className={`mb-2 ${compact ? 'text-xs uppercase tracking-[0.18em] text-slate-400' : 'text-sm font-semibold text-slate-700'}`}>{label}</p>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${compact ? 'bg-white' : 'bg-slate-50'}`}
      />
    </label>
  )
}
