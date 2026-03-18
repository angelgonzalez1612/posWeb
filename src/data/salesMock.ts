import type { Sale } from '../types'

export const salesMock: Sale[] = [
  {
    id: 1,
    fecha: new Date().toISOString(),
    total: 44,
    metodoPago: 'efectivo',
    usuarioId: 2,
    detalles: [
      { id: 1, productoId: 1, nombre: 'Coca Cola 600ml', cantidad: 2, precio: 22, subtotal: 44 },
    ],
  },
  {
    id: 2,
    fecha: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    total: 117,
    metodoPago: 'tarjeta',
    usuarioId: 2,
    detalles: [
      { id: 2, productoId: 2, nombre: 'Sabritas Original', cantidad: 1, precio: 18, subtotal: 18 },
      { id: 3, productoId: 8, nombre: 'Frijol negro', cantidad: 2.75, precio: 36, subtotal: 99 },
    ],
  },
]
