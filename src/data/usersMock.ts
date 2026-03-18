import type { User } from '../types'

export const usersMock: User[] = [
  { id: 1, nombre: 'Admin General', email: 'admin@tienda.local', rol: 'admin' },
  { id: 2, nombre: 'Caja Mostrador', email: 'vendedor@tienda.local', rol: 'vendedor' },
]
