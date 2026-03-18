# POS Web

Aplicacion web del sistema POS para tienda de abarrotes.

## Stack

- React
- Vite
- TailwindCSS
- TypeScript

## Funciones principales

- Login con roles `admin` y `vendedor`
- Caja rapida para empleado
- Busqueda por nombre, marca, categoria y codigo de barras
- Soporte para lector de codigo de barras USB
- Carrito de compra y cobro
- Productos por pieza y a granel
- Gestion de productos, inventario, ventas y usuarios
- Generacion de PDF para codigos internos

## Variables de entorno

Crea un archivo `.env` con:

```env
VITE_API_BASE_URL="http://localhost:4000/api"
```

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Credenciales demo

- Admin
  - correo: `admin@tienda.local`
  - contrasena: `admin123`

- Empleado
  - correo: `empleado@tienda.local`
  - contrasena: `empleado123`

## Nota

Este proyecto depende del backend en `http://localhost:4000/api` o en la URL que definas en `VITE_API_BASE_URL`.
