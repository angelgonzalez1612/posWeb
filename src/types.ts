export type Role = 'admin' | 'vendedor'
export type Section = 'dashboard' | 'ventas' | 'productos' | 'inventario' | 'ajustes'
export type SaleType = 'pieza' | 'peso'
export type WeightUnit = 'kg' | 'g'
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia'

export type Product = {
  id: number
  nombre: string
  codigo_barras: string
  marca?: string
  cantidad?: string
  categoria?: string
  precio: number
  tipo_venta: SaleType
  stock: number
  createdAt: string
}

export type ProductLookupResult = {
  id?: number
  nombre: string
  codigo_barras: string
  tipo_venta: SaleType
  precio: number
  stock: number
  existsInCatalog: boolean
  source: string
  marca?: string
  cantidad?: string
  categoria?: string
  descripcion?: string
  imagen?: string
}

export type BarcodePdfResponse = {
  filename: string
  contentBase64: string
}

export type CartItem = {
  productId: number
  nombre: string
  codigo_barras: string
  precio: number
  tipo_venta: SaleType
  quantity: number
  weightUnit: WeightUnit
  weightValue: number
}

export type SaleDetail = {
  id: number
  productoId: number
  nombre: string
  cantidad: number
  precio: number
  subtotal: number
}

export type Sale = {
  id: number
  fecha: string
  total: number
  metodoPago: PaymentMethod
  usuarioId: number
  detalles: SaleDetail[]
}

export type User = {
  id: number
  nombre: string
  email: string
  rol: Role
}

export type AuthSession = {
  token: string
  user: User
}

export type StockMovement = {
  id: number
  productoId: number
  tipo: 'entrada' | 'salida'
  cantidad: number
  fecha: string
}

export type CashCut = {
  id: number
  fechaInicio: string
  fechaFin: string
  totalVentas: number
  totalEfectivo: number
  totalTarjeta: number
  totalTransferencia: number
  cantidadVentas: number
  usuarioCierreId: number
  createdAt: string
  usuarioCierre?: User | null
}
