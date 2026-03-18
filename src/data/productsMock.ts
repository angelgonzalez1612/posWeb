import type { Product } from '../types'

export const productsMock: Product[] = [
  { id: 1, nombre: 'Coca Cola 600ml', codigo_barras: '7501055300021', marca: 'Coca-Cola', cantidad: '600 ml', categoria: 'Bebidas', precio: 22, tipo_venta: 'pieza', stock: 48, createdAt: '2026-03-01T09:00:00.000Z' },
  { id: 2, nombre: 'Sabritas Original', codigo_barras: '7501011111111', marca: 'Sabritas', cantidad: '45 g', categoria: 'Botanas', precio: 18, tipo_venta: 'pieza', stock: 34, createdAt: '2026-03-01T09:05:00.000Z' },
  { id: 3, nombre: 'Galletas Maria', codigo_barras: '7501003333333', marca: 'Gamesa', cantidad: '170 g', categoria: 'Galletas', precio: 15, tipo_venta: 'pieza', stock: 40, createdAt: '2026-03-01T09:10:00.000Z' },
  { id: 4, nombre: 'Agua 1L', codigo_barras: '7501004444444', marca: 'Bonafont', cantidad: '1 L', categoria: 'Agua', precio: 12, tipo_venta: 'pieza', stock: 64, createdAt: '2026-03-01T09:15:00.000Z' },
  { id: 5, nombre: 'Jamon de pavo', codigo_barras: '2000000000001', marca: 'Mostrador', cantidad: 'Granel', categoria: 'Embutidos', precio: 210, tipo_venta: 'peso', stock: 8.5, createdAt: '2026-03-01T09:20:00.000Z' },
  { id: 6, nombre: 'Queso Oaxaca', codigo_barras: '2000000000002', marca: 'Mostrador', cantidad: 'Granel', categoria: 'Lacteos', precio: 198, tipo_venta: 'peso', stock: 6.25, createdAt: '2026-03-01T09:25:00.000Z' },
  { id: 7, nombre: 'Chiles secos', codigo_barras: '2000000000005', marca: 'Granel', cantidad: 'Granel', categoria: 'Abarrotes', precio: 175, tipo_venta: 'peso', stock: 12.3, createdAt: '2026-03-01T09:30:00.000Z' },
  { id: 8, nombre: 'Frijol negro', codigo_barras: '2000000000004', marca: 'Granel', cantidad: 'Granel', categoria: 'Abarrotes', precio: 36, tipo_venta: 'peso', stock: 18, createdAt: '2026-03-01T09:35:00.000Z' },
  { id: 9, nombre: 'Arroz', codigo_barras: '2000000000003', marca: 'Granel', cantidad: 'Granel', categoria: 'Abarrotes', precio: 32, tipo_venta: 'peso', stock: 25, createdAt: '2026-03-01T09:40:00.000Z' },
]
