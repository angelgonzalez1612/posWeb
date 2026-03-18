import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { CartPanel } from '../components/CartPanel'
import { Header } from '../components/Header'
import { InventoryTable } from '../components/InventoryTable'
import { ProductTable } from '../components/ProductTable'
import { ProductsManager } from '../components/ProductsManager'
import { SalesSummary } from '../components/SalesSummary'
import { SettingsPanel } from '../components/SettingsPanel'
import { Sidebar } from '../components/Sidebar'
import { productsMock } from '../data/productsMock'
import { salesMock } from '../data/salesMock'
import { usersMock } from '../data/usersMock'
import { apiRequest, clearSession } from '../services/api'
import type { AuthSession, BarcodePdfResponse, CartItem, CashCut, PaymentMethod, Product, ProductLookupResult, Role, Sale, Section, StockMovement, User, WeightUnit } from '../types'

const TAX_RATE = 0.16
const weightPresets = [
  { label: '1/4 (250 g)', value: 250 },
  { label: '1/2 (500 g)', value: 500 },
]

type InventoryResponse = {
  items: Product[]
  movements: StockMovement[]
}

type SalesResponse = {
  data: Sale[]
}

type CashCutResponse = {
  data: CashCut[]
}

type BrowserBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

type ProductCategory = 'Todos' | 'Agua' | 'Bebidas' | 'Pan' | 'Dulces' | 'Botanas' | 'Galletas' | 'Lacteos' | 'Embutidos' | 'Abarrotes' | 'Cereales' | 'Despensa' | 'Jugos' | 'General'
type AdminDateRange = 'hoy' | '7dias' | '30dias'
function getProductCategory(product: Product): ProductCategory {
  const category = (product.categoria || '').trim()
  if (!category) return 'General'

  const normalized = category.toLowerCase()
  if (normalized === 'agua') return 'Agua'
  if (normalized === 'bebidas') return 'Bebidas'
  if (normalized === 'pan') return 'Pan'
  if (normalized === 'dulces') return 'Dulces'
  if (normalized === 'botanas') return 'Botanas'
  if (normalized === 'galletas') return 'Galletas'
  if (normalized === 'lacteos') return 'Lacteos'
  if (normalized === 'embutidos') return 'Embutidos'
  if (normalized === 'abarrotes') return 'Abarrotes'
  if (normalized === 'cereales') return 'Cereales'
  if (normalized === 'despensa') return 'Despensa'
  if (normalized === 'jugos') return 'Jugos'
  return 'General'
}

type DashboardProps = {
  session: AuthSession
  onLogout: () => void
}

export function Dashboard({ session, onLogout }: DashboardProps) {
  const role = session.user.rol as Role
  const isEmployee = role === 'vendedor'
  const [activeSection, setActiveSection] = useState<Section>('dashboard')
  const showCartPanel = isEmployee && activeSection === 'dashboard'
  const [barcode, setBarcode] = useState('')
  const [isBarcodeLookupLoading, setIsBarcodeLookupLoading] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [inventoryFilter, setInventoryFilter] = useState('')
  const [inventorySaleTypeFilter, setInventorySaleTypeFilter] = useState<'todos' | 'pieza' | 'peso'>('todos')
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('todas')
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('Todos')
  const [adminDateRange, setAdminDateRange] = useState<AdminDateRange>('7dias')
  const [products, setProducts] = useState<Product[]>(productsMock)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [sales, setSales] = useState<Sale[]>(salesMock)
  const [cashCuts, setCashCuts] = useState<CashCut[]>([])
  const [users, setUsers] = useState<User[]>(usersMock)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [weightModalProduct, setWeightModalProduct] = useState<Product | null>(null)
  const [weightValue, setWeightValue] = useState('500')
  const [weightUnit] = useState<WeightUnit>('g')
  const [quickImportProduct, setQuickImportProduct] = useState<ProductLookupResult | null>(null)
  const [quickImportPrice, setQuickImportPrice] = useState('0')
  const [quickImportCategory, setQuickImportCategory] = useState('')
  const [isQuickImportSaving, setIsQuickImportSaving] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [employeeStockModalOpen, setEmployeeStockModalOpen] = useState(false)
  const [employeeStockMode, setEmployeeStockMode] = useState<'existing' | 'new'>('existing')
  const [employeeStockProductId, setEmployeeStockProductId] = useState<number | ''>('')
  const [employeeStockQuantity, setEmployeeStockQuantity] = useState('')
  const [isEmployeeStockSaving, setIsEmployeeStockSaving] = useState(false)
  const [employeeNewProductForm, setEmployeeNewProductForm] = useState({
    codigo_barras: '',
    nombre: '',
    categoria: '',
    precio: '',
    cantidadInicial: '',
  })
  const [isEmployeeNewProductSaving, setIsEmployeeNewProductSaving] = useState(false)
  const [isEmployeeNewProductLookupLoading, setIsEmployeeNewProductLookupLoading] = useState(false)
  const [employeeCameraOpen, setEmployeeCameraOpen] = useState(false)
  const [employeeCameraError, setEmployeeCameraError] = useState('')
  const [highlightedMatchIndex, setHighlightedMatchIndex] = useState(0)
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const modalSearchInputRef = useRef<HTMLInputElement>(null)
  const paymentInputRef = useRef<HTMLInputElement>(null)
  const quickImportPriceRef = useRef<HTMLInputElement>(null)
  const employeeCameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const employeeCameraStreamRef = useRef<MediaStream | null>(null)
  const scannerBufferRef = useRef('')
  const scannerTimeoutRef = useRef<number | null>(null)
  const scannerLastInputRef = useRef(0)
  const audioContextRef = useRef<AudioContext | null>(null)

  function stopEmployeeCamera() {
    employeeCameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    employeeCameraStreamRef.current = null
    if (employeeCameraVideoRef.current) {
      employeeCameraVideoRef.current.srcObject = null
    }
  }

  function resetEmployeeStockModal() {
    stopEmployeeCamera()
    setEmployeeStockModalOpen(false)
    setEmployeeStockMode('existing')
    setEmployeeStockProductId('')
    setEmployeeStockQuantity('')
    setEmployeeNewProductForm({
      codigo_barras: '',
      nombre: '',
      categoria: '',
      precio: '',
      cantidadInicial: '',
    })
    setEmployeeCameraOpen(false)
    setEmployeeCameraError('')
  }

  useEffect(() => {
    if (isEmployee) {
      setActiveSection('dashboard')
    }
  }, [isEmployee])

  useEffect(() => {
    barcodeInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (searchModalOpen) {
      window.setTimeout(() => modalSearchInputRef.current?.focus(), 0)
    }
  }, [searchModalOpen])

  useEffect(() => {
    if (paymentModalOpen) {
      window.setTimeout(() => paymentInputRef.current?.focus(), 0)
    }
  }, [paymentModalOpen])

  useEffect(() => {
    if (quickImportProduct) {
      window.setTimeout(() => quickImportPriceRef.current?.focus(), 0)
    }
  }, [quickImportProduct])

  useEffect(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingElement = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      if (event.key.toLowerCase() === 'b' && event.ctrlKey && !event.metaKey && !event.altKey && !isTypingElement) {
        event.preventDefault()
        setSearchModalOpen(true)
        return
      }

      if (event.key === 'Escape') {
        if (quickImportProduct) {
          setQuickImportProduct(null)
          setQuickImportPrice('0')
          setQuickImportCategory('')
          return
        }

        if (paymentModalOpen) {
          setPaymentModalOpen(false)
          setPaymentAmount('')
          return
        }

        if (employeeStockModalOpen) {
          resetEmployeeStockModal()
          return
        }

        if (searchModalOpen) {
          setSearchModalOpen(false)
          setSearchQuery('')
          setHighlightedMatchIndex(0)
          return
        }

        if (weightModalProduct) {
          setWeightModalProduct(null)
          return
        }

        if (barcode) {
          setBarcode('')
          return
        }
      }

      if (event.key === 'Enter' && event.ctrlKey && cartItems.length > 0) {
        event.preventDefault()
        if (paymentModalOpen) {
          void handleCheckout()
        } else {
          openPaymentModal()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  }, [barcode, cartItems.length, employeeStockModalOpen, paymentModalOpen, quickImportProduct, searchModalOpen, weightModalProduct])

  useEffect(() => {
    if (!employeeCameraOpen) {
      stopEmployeeCamera()
      return
    }

    let cancelled = false
    let intervalId: number | null = null

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setEmployeeCameraError('Tu navegador no permite abrir la camara desde esta pantalla.')
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        employeeCameraStreamRef.current = stream
        if (employeeCameraVideoRef.current) {
          employeeCameraVideoRef.current.srcObject = stream
          await employeeCameraVideoRef.current.play().catch(() => undefined)
        }

        const BarcodeDetectorConstructor = (
          window as Window & {
            BarcodeDetector?: new (options?: { formats?: string[] }) => BrowserBarcodeDetector
          }
        ).BarcodeDetector

        if (!BarcodeDetectorConstructor) {
          setEmployeeCameraError('Tu navegador abre la camara, pero no soporta lectura nativa de codigo. Puedes capturarlo manualmente.')
          return
        }

        const detector = new BarcodeDetectorConstructor({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
        })

        intervalId = window.setInterval(async () => {
          if (cancelled || !employeeCameraVideoRef.current || employeeCameraVideoRef.current.readyState < 2) return
          try {
            const detections = await detector.detect(employeeCameraVideoRef.current)
            const code = detections.find((item) => item.rawValue?.trim())?.rawValue?.trim()
            if (!code) return

            setEmployeeNewProductForm((current) => ({
              ...current,
              codigo_barras: code,
              nombre: '',
              categoria: '',
              precio: '',
            }))
            setEmployeeCameraOpen(false)
            stopEmployeeCamera()
            void lookupEmployeeNewProductBarcode(code)
          } catch {
            setEmployeeCameraError('No se pudo leer el codigo con la camara. Intenta de nuevo o capturalo manualmente.')
          }
        }, 700)
      } catch {
        setEmployeeCameraError('No se pudo acceder a la camara. Revisa permisos del navegador.')
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      if (intervalId) {
        window.clearInterval(intervalId)
      }
      stopEmployeeCamera()
    }
  }, [employeeCameraOpen])

  useEffect(() => {
    const resetScannerBuffer = () => {
      scannerBufferRef.current = ''
      scannerLastInputRef.current = 0
      if (scannerTimeoutRef.current) {
        window.clearTimeout(scannerTimeoutRef.current)
        scannerTimeoutRef.current = null
      }
    }

    const handleScannerKeydown = (event: KeyboardEvent) => {
      if (searchModalOpen || paymentModalOpen || weightModalProduct) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const isTypingElement =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      if (isTypingElement) return

      const key = event.key
      const now = event.timeStamp
      const isLikelyScannerBurst = scannerLastInputRef.current === 0 || now - scannerLastInputRef.current < 60

      if (key === 'Enter') {
        if (scannerBufferRef.current.length >= 4) {
          const scannedCode = scannerBufferRef.current
          resetScannerBuffer()
          setBarcode(scannedCode)
          handleBarcodeValueSubmit(scannedCode)
        }
        return
      }

      if (key === 'Escape' || key === 'Tab' || key.length !== 1) return
      if (!/^[\w\-./]+$/.test(key)) return

      if (!isLikelyScannerBurst) {
        scannerBufferRef.current = ''
      }

      scannerBufferRef.current += key
      scannerLastInputRef.current = now

      if (scannerTimeoutRef.current) {
        window.clearTimeout(scannerTimeoutRef.current)
      }

      scannerTimeoutRef.current = window.setTimeout(() => {
        resetScannerBuffer()
      }, 120)
    }

    window.addEventListener('keydown', handleScannerKeydown)
    return () => {
      window.removeEventListener('keydown', handleScannerKeydown)
      resetScannerBuffer()
    }
  }, [paymentModalOpen, searchModalOpen, weightModalProduct, products])

  useEffect(() => {
    const loadData = async () => {
      try {
        const inventory = await apiRequest<InventoryResponse>('/inventario', { token: session.token })
        const salesResponse = await apiRequest<SalesResponse>('/ventas', { token: session.token })

        setProducts(inventory.items)
        setMovements(inventory.movements)
        setSales(salesResponse.data)

        if (role === 'admin') {
          const userResponse = await apiRequest<User[]>('/usuarios', { token: session.token })
          const cashCutResponse = await apiRequest<CashCutResponse>('/cortes-caja', { token: session.token })
          setUsers(userResponse)
          setCashCuts(cashCutResponse.data)
        } else {
          setUsers([session.user])
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sesion no valida'
        if (message.toLowerCase().includes('sesion')) {
          clearSession()
          onLogout()
          return
        }
        playWarningBeep()
      }
    }

    loadData()
  }, [onLogout, role, session.token, session.user])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = activeCategory === 'Todos' || getProductCategory(product) === activeCategory
      return matchesCategory
    })
  }, [activeCategory, products])

  const quickProducts = useMemo(
    () =>
      products
        .slice()
        .sort((a, b) => {
          const saleWeight = (product: Product) => sales.reduce((sum, sale) => sum + sale.detalles.filter((detail) => detail.productoId === product.id).length, 0)
          return saleWeight(b) - saleWeight(a)
        })
        .slice(0, 6),
    [products, sales],
  )

  const searchMatches = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()
    if (!query) {
      return products.slice(0, 18)
    }

    return products
      .filter((product) => {
        const haystack = [
          product.nombre,
          product.codigo_barras,
          product.marca,
          product.cantidad,
          product.categoria,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(query)
      })
      .slice(0, 18)
  }, [deferredSearchQuery, products])

  const categories = useMemo<ProductCategory[]>(() => {
    const dynamicCategories = new Set<ProductCategory>(['Todos'])
    products.forEach((product) => dynamicCategories.add(getProductCategory(product)))
    return Array.from(dynamicCategories)
  }, [products])

  const matchedBarcodeProduct = products.find((product) => product.codigo_barras === barcode.trim()) || null
  const employeeSelectedProduct = products.find((product) => product.id === employeeStockProductId) || null
  const highlightedMatch = searchMatches[highlightedMatchIndex] || null
  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.precio * item.quantity, 0), [cartItems])
  const taxes = useMemo(() => subtotal * TAX_RATE, [subtotal])
  const total = useMemo(() => subtotal + taxes, [subtotal, taxes])
  const paymentReceived = Number(paymentAmount || 0)
  const requiresCashAmount = paymentMethod === 'efectivo'
  const change = requiresCashAmount ? Math.max(paymentReceived - total, 0) : 0
  const paymentShortfall = requiresCashAmount ? Math.max(total - paymentReceived, 0) : 0

  const filteredInventory = products.filter((product) => {
    const haystack = [product.nombre, product.codigo_barras, product.marca, product.cantidad, product.categoria].filter(Boolean).join(' ').toLowerCase()
    const matchesText = inventoryFilter ? haystack.includes(inventoryFilter.toLowerCase()) : true
    const matchesSaleType = inventorySaleTypeFilter === 'todos' ? true : product.tipo_venta === inventorySaleTypeFilter
    const matchesCategory = inventoryCategoryFilter === 'todas' ? true : getProductCategory(product) === inventoryCategoryFilter
    return matchesText && matchesSaleType && matchesCategory
  })
  const inventoryCategories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => getProductCategory(product)).filter((category) => category !== 'Todos'))).sort(),
    [products],
  )
  const adminDashboardStats = useMemo(() => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const rangeStart = (() => {
      if (adminDateRange === 'hoy') return startOfDay
      if (adminDateRange === '30dias') {
        const date = new Date(startOfDay)
        date.setDate(date.getDate() - 29)
        return date
      }
      const date = new Date(startOfDay)
      date.setDate(date.getDate() - 6)
      return date
    })()
    const todaySales = sales.filter((sale) => new Date(sale.fecha) >= startOfDay)
    const rangedSales = sales.filter((sale) => new Date(sale.fecha) >= rangeStart)
    const lowStockProducts = products.filter((product) => product.stock <= (product.tipo_venta === 'peso' ? 3 : 10))
    const inventoryValue = products.reduce((sum, product) => sum + product.precio * product.stock, 0)
    const salesByPaymentMethod = {
      efectivo: rangedSales.filter((sale) => sale.metodoPago === 'efectivo').reduce((sum, sale) => sum + sale.total, 0),
      tarjeta: rangedSales.filter((sale) => sale.metodoPago === 'tarjeta').reduce((sum, sale) => sum + sale.total, 0),
      transferencia: rangedSales.filter((sale) => sale.metodoPago === 'transferencia').reduce((sum, sale) => sum + sale.total, 0),
    }
    const salesByCashier = users
      .filter((user) => user.rol === 'vendedor')
      .map((user) => {
        const cashierSales = rangedSales.filter((sale) => sale.usuarioId === user.id)
        return {
          id: user.id,
          nombre: user.nombre,
          total: cashierSales.reduce((sum, sale) => sum + sale.total, 0),
          count: cashierSales.length,
        }
      })
      .sort((a, b) => b.total - a.total)
    const productTotals = new Map<number, { nombre: string; cantidad: number; total: number }>()
    rangedSales.forEach((sale) => {
      sale.detalles.forEach((detail) => {
        const current = productTotals.get(detail.productoId)
        const productName = detail.nombre || products.find((product) => product.id === detail.productoId)?.nombre || `Producto #${detail.productoId}`
        const detailSubtotal = typeof detail.subtotal === 'number' ? detail.subtotal : detail.precio * detail.cantidad
        if (current) {
          current.cantidad += detail.cantidad
          current.total += detailSubtotal
          return
        }
        productTotals.set(detail.productoId, {
          nombre: productName,
          cantidad: detail.cantidad,
          total: detailSubtotal,
        })
      })
    })
    const topProducts = Array.from(productTotals.entries())
      .map(([id, product]) => ({ id, ...product }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    return {
      totalSales: sales.reduce((sum, sale) => sum + sale.total, 0),
      todaySalesTotal: todaySales.reduce((sum, sale) => sum + sale.total, 0),
      todaySalesCount: todaySales.length,
      rangedSalesTotal: rangedSales.reduce((sum, sale) => sum + sale.total, 0),
      rangedSalesCount: rangedSales.length,
      totalProducts: products.length,
      lowStockProducts,
      inventoryValue,
      adminUsers: users.filter((user) => user.rol === 'admin').length,
      cashierUsers: users.filter((user) => user.rol === 'vendedor').length,
      salesByPaymentMethod,
      salesByCashier,
      topProducts,
      recentSales: rangedSales.slice(0, 5),
      recentMovements: movements.slice(0, 6),
      salesTrend: Array.from({ length: 7 }, (_, index) => {
        const bucketDate = new Date(now)
        bucketDate.setDate(now.getDate() - (6 - index))
        const label = bucketDate.toLocaleDateString('es-MX', { weekday: 'short' })
        const dayStart = new Date(bucketDate.getFullYear(), bucketDate.getMonth(), bucketDate.getDate())
        const dayEnd = new Date(bucketDate.getFullYear(), bucketDate.getMonth(), bucketDate.getDate() + 1)
        const value = sales
          .filter((sale) => {
            const saleDate = new Date(sale.fecha)
            return saleDate >= dayStart && saleDate < dayEnd
          })
          .reduce((sum, sale) => sum + sale.total, 0)

        return {
          label: label.replace('.', ''),
          value,
        }
      }),
    }
  }, [adminDateRange, movements, products, sales, users])
  const maxTrendValue = useMemo(
    () => Math.max(...adminDashboardStats.salesTrend.map((item) => item.value), 1),
    [adminDashboardStats.salesTrend],
  )
  const paymentMethodChart = useMemo(
    () => [
      { label: 'Efectivo', value: adminDashboardStats.salesByPaymentMethod.efectivo, color: 'bg-emerald-500' },
      { label: 'Tarjeta', value: adminDashboardStats.salesByPaymentMethod.tarjeta, color: 'bg-sky-500' },
      { label: 'Transferencia', value: adminDashboardStats.salesByPaymentMethod.transferencia, color: 'bg-slate-500' },
    ],
    [adminDashboardStats.salesByPaymentMethod],
  )
  const paymentMethodTotal = useMemo(
    () => paymentMethodChart.reduce((sum, item) => sum + item.value, 0),
    [paymentMethodChart],
  )

  const reloadInventory = async () => {
    try {
      const inventory = await apiRequest<InventoryResponse>('/inventario', { token: session.token })
      setProducts(inventory.items)
      setMovements(inventory.movements)
    } catch {
      // keep local fallback
    }
  }

  const reloadSales = async () => {
    try {
      const salesResponse = await apiRequest<SalesResponse>('/ventas', { token: session.token })
      setSales(salesResponse.data)
    } catch {
      // keep local fallback
    }
  }

  const playTone = (frequency: number, duration = 0.13, peakGain = 0.08) => {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor()
    }

    const context = audioContextRef.current
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, context.currentTime)
    gainNode.gain.setValueAtTime(0.001, context.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(peakGain, context.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration)

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + duration + 0.01)
  }

  const playSuccessBeep = () => {
    playTone(880, 0.13, 0.08)
  }

  const playWarningBeep = () => {
    playTone(320, 0.18, 0.07)
  }

  const isConnectivityError = (error: unknown) =>
    error instanceof Error &&
    (/failed to fetch/i.test(error.message) ||
      /network/i.test(error.message) ||
      /load failed/i.test(error.message))

  const addPieceProduct = (product: Product) => {
    startTransition(() => {
      setCartItems((current) => {
        const existing = current.find((item) => item.productId === product.id)
        if (existing) {
          return current.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        }
        return [...current, { productId: product.id, nombre: product.nombre, codigo_barras: product.codigo_barras, precio: product.precio, tipo_venta: product.tipo_venta, quantity: 1, weightUnit: 'kg', weightValue: 1 }]
      })
    })
    playSuccessBeep()
  }

  const addWeightProduct = () => {
    if (!weightModalProduct) return

    const numericValue = Number(weightValue || 0)
    const quantity = numericValue / 1000

    setCartItems((current) => {
      const existing = current.find((item) => item.productId === weightModalProduct.id)
      if (existing) {
        return current.map((item) => item.productId === weightModalProduct.id ? { ...item, weightUnit, weightValue: numericValue, quantity: item.quantity + quantity } : item)
      }
        return [...current, { productId: weightModalProduct.id, nombre: weightModalProduct.nombre, codigo_barras: weightModalProduct.codigo_barras, precio: weightModalProduct.precio, tipo_venta: 'peso', quantity, weightUnit: 'g', weightValue: numericValue }]
      })

    playSuccessBeep()
    setWeightModalProduct(null)
    setWeightValue('500')
  }

  const applyWeightPreset = (value: number) => {
    setWeightValue(String(value))
  }

  const handleAddProduct = (product: Product) => {
    if (product.tipo_venta === 'peso') {
      setWeightModalProduct(product)
      return
    }
    addPieceProduct(product)
  }

  const handleBarcodeValueSubmit = (rawCode: string) => {
    const normalizedCode = rawCode.trim()
    if (!normalizedCode) return

      const product = products.find((item) => item.codigo_barras === normalizedCode)
      if (!product) {
        setBarcode(normalizedCode)
        setIsBarcodeLookupLoading(true)
        void lookupProductByBarcode(normalizedCode)
        .then((result) => {
          if (result.existsInCatalog) {
            const existingProduct = products.find((item) => item.codigo_barras === result.codigo_barras)
            if (existingProduct) {
              handleAddProduct(existingProduct)
              setBarcode('')
              return
            }
          }

      setQuickImportProduct(result)
      setQuickImportPrice(String(result.precio ?? 0))
          setQuickImportCategory(result.categoria || 'General')
          playWarningBeep()
        })
        .catch(() => {
          playWarningBeep()
        })
        .finally(() => {
          setIsBarcodeLookupLoading(false)
        })
        return
      }
      handleAddProduct(product)
      setBarcode('')
  }

  const handleBarcodeSubmit = () => {
    handleBarcodeValueSubmit(barcode)
  }

  const handleSearchModalSubmit = () => {
    if (!highlightedMatch) {
      return
    }

    handleAddProduct(highlightedMatch)
    setSearchModalOpen(false)
    setSearchQuery('')
    setHighlightedMatchIndex(0)
    barcodeInputRef.current?.focus()
  }

  const handleBarcodeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleBarcodeSubmit()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setBarcode('')
    }
  }

  const handleSearchModalKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchMatches.length) {
      if (event.key === 'Enter') {
        event.preventDefault()
        handleSearchModalSubmit()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedMatchIndex((current) => (current + 1) % searchMatches.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedMatchIndex((current) => (current - 1 + searchMatches.length) % searchMatches.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      handleSearchModalSubmit()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setSearchModalOpen(false)
      setSearchQuery('')
      setHighlightedMatchIndex(0)
      barcodeInputRef.current?.focus()
    }
  }

  const handleSelectSearchMatch = (product: Product) => {
    handleAddProduct(product)
    setSearchModalOpen(false)
    setSearchQuery('')
    setHighlightedMatchIndex(0)
    barcodeInputRef.current?.focus()
  }

  const updatePieceQuantity = (productId: number, delta: number) => {
    setCartItems((current) => current.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0))
  }

  const removeCartItem = (productId: number) => {
    setCartItems((current) => current.filter((item) => item.productId !== productId))
  }

  const updateWeightItemValue = (productId: number, value: number) => {
    setCartItems((current) => current.map((item) => item.productId !== productId ? item : { ...item, weightUnit: 'g', weightValue: value, quantity: value / 1000 }))
  }

  const applyWeightPresetToCartItem = (productId: number, value: number) => {
    setCartItems((current) =>
      current.map((item) =>
        item.productId !== productId
          ? item
          : {
              ...item,
              weightUnit: 'g',
              weightValue: value,
              quantity: value / 1000,
            },
      ),
    )
  }

  const openPaymentModal = () => {
    if (cartItems.length === 0) return
    setPaymentMethod('efectivo')
    setPaymentAmount(total.toFixed(2))
    setPaymentModalOpen(true)
  }

  const handleCheckout = async () => {
    if (cartItems.length === 0 || (requiresCashAmount && paymentReceived < total)) return

    const saleId = sales.length + 1

    const localSale: Sale = {
      id: saleId,
      fecha: new Date().toISOString(),
      total: Number(total.toFixed(2)),
      metodoPago: paymentMethod,
      usuarioId: session.user.id,
      detalles: cartItems.map((item, index) => ({ id: saleId * 100 + index, productoId: item.productId, nombre: item.nombre, cantidad: Number(item.quantity.toFixed(3)), precio: item.precio, subtotal: Number((item.precio * item.quantity).toFixed(2)) })),
    }

    try {
      await apiRequest<Sale>('/ventas', { method: 'POST', token: session.token, body: JSON.stringify({ usuarioId: session.user.id, metodoPago: paymentMethod, items: cartItems.map((item) => ({ productoId: item.productId, cantidad: item.quantity, precio: item.precio })) }) })
      await Promise.all([reloadInventory(), reloadSales()])
      playSuccessBeep()
    } catch {
      setSales((current) => [localSale, ...current])
      setProducts((current) => current.map((product) => {
        const cartItem = cartItems.find((item) => item.productId === product.id)
        return cartItem ? { ...product, stock: Number((product.stock - cartItem.quantity).toFixed(3)) } : product
      }))
      setMovements((current) => [...cartItems.map((item, index) => ({ id: current.length + index + 1, productoId: item.productId, tipo: 'salida' as const, cantidad: item.quantity, fecha: new Date().toISOString() })), ...current])
      playWarningBeep()
    }

    setCartItems([])
    setPaymentModalOpen(false)
    setPaymentMethod('efectivo')
    setPaymentAmount('')
  }

  const createProduct = async (payload: Omit<Product, 'id' | 'createdAt'>) => {
    try {
      const created = await apiRequest<Product>('/productos', { method: 'POST', token: session.token, body: JSON.stringify(payload) })
      setProducts((current) => [created, ...current])
      playSuccessBeep()
    } catch (error) {
      if (!isConnectivityError(error)) {
        playWarningBeep()
        throw error
      }
      setProducts((current) => [{ id: current.length + 1, createdAt: new Date().toISOString(), ...payload }, ...current])
      playWarningBeep()
    }
  }

  const updateProduct = async (productId: number, payload: Partial<Omit<Product, 'id' | 'createdAt'>>) => {
    try {
      const updated = await apiRequest<Product>(`/productos/${productId}`, { method: 'PUT', token: session.token, body: JSON.stringify(payload) })
      setProducts((current) => current.map((product) => product.id === productId ? updated : product))
    } catch (error) {
      if (!isConnectivityError(error)) {
        throw error
      }
      setProducts((current) => current.map((product) => product.id === productId ? { ...product, ...payload } : product))
    }
  }

  const deleteProduct = async (productId: number) => {
    try {
      await apiRequest<void>(`/productos/${productId}`, { method: 'DELETE', token: session.token })
      playSuccessBeep()
    } catch (error) {
      if (!isConnectivityError(error)) {
        playWarningBeep()
        throw error
      }
      playWarningBeep()
    }
    setProducts((current) => current.filter((product) => product.id !== productId))
  }

  const generateProductBarcodePdf = async (productIds: number[], copies: number) => {
    if (productIds.length === 0) return

    const response = await apiRequest<BarcodePdfResponse>('/productos/barcodes/pdf', {
      method: 'POST',
      token: session.token,
      body: JSON.stringify({ productIds, copies }),
    })

    const byteCharacters = atob(response.contentBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let index = 0; index < byteCharacters.length; index += 1) {
      byteNumbers[index] = byteCharacters.charCodeAt(index)
    }

    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = response.filename
      anchor.click()
      URL.revokeObjectURL(url)
    }

  const lookupProductByBarcode = async (barcode: string) => {
    return apiRequest<ProductLookupResult>(`/productos/lookup/${encodeURIComponent(barcode)}`, {
      token: session.token,
    })
  }

  const quickImportProductFromCashier = async () => {
    if (!quickImportProduct) return

    setIsQuickImportSaving(true)
    try {
      const created = await apiRequest<Product>('/productos/quick-import', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          nombre: quickImportProduct.nombre,
          codigo_barras: quickImportProduct.codigo_barras,
          marca: quickImportProduct.marca || '',
          cantidad: quickImportProduct.cantidad || '',
          categoria: quickImportCategory || quickImportProduct.categoria || 'General',
          precio: Number(quickImportPrice || 0),
          tipo_venta: quickImportProduct.tipo_venta || 'pieza',
          stock: 0,
        }),
      })

      setProducts((current) => [created, ...current])
      handleAddProduct(created)
      setQuickImportProduct(null)
      setQuickImportPrice('0')
      setQuickImportCategory('')
      setBarcode('')
    } catch (error) {
      console.error(error)
    } finally {
      setIsQuickImportSaving(false)
    }
  }

  const openInventoryForProduct = ({ nombre, codigo_barras }: { nombre: string; codigo_barras: string }) => {
    setInventoryFilter(nombre || codigo_barras)
    setActiveSection('inventario')
  }

  const createUser = async (payload: { nombre: string; email: string; rol: Role; password: string }) => {
    try {
      const created = await apiRequest<User>('/usuarios', { method: 'POST', token: session.token, body: JSON.stringify(payload) })
      setUsers((current) => [...current, created])
      playSuccessBeep()
    } catch {
      const { password: _password, ...safePayload } = payload
      setUsers((current) => [...current, { id: current.length + 1, ...safePayload }])
      playWarningBeep()
    }
  }

  const updateUser = async (userId: number, payload: { nombre?: string; email?: string; rol?: Role; password?: string }) => {
    try {
      const updated = await apiRequest<User>(`/usuarios/${userId}`, { method: 'PUT', token: session.token, body: JSON.stringify(payload) })
      setUsers((current) => current.map((user) => user.id === userId ? updated : user))
    } catch {
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, ...payload } : user))
    }
  }

  const registerInventoryOperation = async ({
    productoId,
    tipo,
    cantidad,
    nuevoStock,
  }: {
    productoId: number
    tipo: 'entrada' | 'salida' | 'ajuste'
    cantidad?: number
    nuevoStock?: number
  }) => {
    const endpoint =
      tipo === 'entrada'
        ? '/inventario/stock/entrada'
        : tipo === 'salida'
          ? '/inventario/stock/salida'
          : '/inventario/stock/ajuste'

    try {
      await apiRequest(endpoint, {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({ productoId, cantidad, nuevoStock }),
      })
      await reloadInventory()
      playSuccessBeep()
    } catch (error) {
      if (!isConnectivityError(error)) {
        playWarningBeep()
        throw error
      }

      const currentProduct = products.find((product) => product.id === productoId)
      const currentStock = currentProduct?.stock || 0
      const delta = tipo === 'ajuste' ? Number((Number(nuevoStock || 0) - currentStock).toFixed(3)) : Number(cantidad || 0)
      const movementType = tipo === 'entrada' ? 'entrada' : tipo === 'salida' ? 'salida' : delta >= 0 ? 'entrada' : 'salida'
      const nextStock =
        tipo === 'entrada'
          ? currentStock + Number(cantidad || 0)
          : tipo === 'salida'
            ? currentStock - Number(cantidad || 0)
            : Number(nuevoStock || 0)

      if (movementType === 'salida' && nextStock < 0) {
        playWarningBeep()
        throw new Error('Stock insuficiente para realizar la operacion')
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === productoId ? { ...product, stock: Number(nextStock.toFixed(3)) } : product,
        ),
      )
      setMovements((current) => [
        {
          id: current.length + 1,
          productoId,
          tipo: movementType,
          cantidad: Math.abs(tipo === 'ajuste' ? delta : Number(cantidad || 0)),
          fecha: new Date().toISOString(),
        },
        ...current,
      ])
      playWarningBeep()
    }
  }

  const createCashCut = async (payload: { fechaInicio: string; fechaFin: string; usuarioCierreId: number }) => {
    try {
      const created = await apiRequest<CashCut>('/cortes-caja', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify(payload),
      })
      setCashCuts((current) => [created, ...current])
      playSuccessBeep()
      await reloadSales()
    } catch (error) {
      if (!isConnectivityError(error)) {
        playWarningBeep()
        throw error
      }

      const salesInRange = sales.filter((sale) => {
        const saleDate = new Date(sale.fecha).getTime()
        return saleDate >= new Date(payload.fechaInicio).getTime() && saleDate <= new Date(payload.fechaFin).getTime()
      })

      const localCut: CashCut = {
        id: cashCuts.length + 1,
        fechaInicio: payload.fechaInicio,
        fechaFin: payload.fechaFin,
        totalVentas: Number(salesInRange.reduce((sum, sale) => sum + sale.total, 0).toFixed(2)),
        totalEfectivo: Number(salesInRange.filter((sale) => sale.metodoPago === 'efectivo').reduce((sum, sale) => sum + sale.total, 0).toFixed(2)),
        totalTarjeta: Number(salesInRange.filter((sale) => sale.metodoPago === 'tarjeta').reduce((sum, sale) => sum + sale.total, 0).toFixed(2)),
        totalTransferencia: Number(salesInRange.filter((sale) => sale.metodoPago === 'transferencia').reduce((sum, sale) => sum + sale.total, 0).toFixed(2)),
        cantidadVentas: salesInRange.length,
        usuarioCierreId: payload.usuarioCierreId,
        createdAt: new Date().toISOString(),
        usuarioCierre: session.user,
      }
      setCashCuts((current) => [localCut, ...current])
      playWarningBeep()
    }
  }

  const submitEmployeeStockEntry = async () => {
    if (!employeeSelectedProduct) return
    const quantity = Number(employeeStockQuantity || 0)
    if (quantity <= 0) return

    setIsEmployeeStockSaving(true)
    try {
      await registerInventoryOperation({
        productoId: employeeSelectedProduct.id,
        tipo: 'entrada',
        cantidad: quantity,
      })
      resetEmployeeStockModal()
    } finally {
      setIsEmployeeStockSaving(false)
    }
  }

  const lookupEmployeeNewProductBarcode = async (overrideBarcode?: string) => {
    const barcodeValue = (overrideBarcode || employeeNewProductForm.codigo_barras).trim()
    if (!barcodeValue) return

    setIsEmployeeNewProductLookupLoading(true)
    setEmployeeCameraError('')
    try {
      const result = await lookupProductByBarcode(barcodeValue)
      const existingLocalProduct = products.find((product) => product.codigo_barras === barcodeValue) || (result.id ? products.find((product) => product.id === result.id) : undefined)

      if (existingLocalProduct || result.existsInCatalog) {
        const resolvedProduct =
          existingLocalProduct ||
          products.find((product) => product.codigo_barras === result.codigo_barras) ||
          null

        if (resolvedProduct) {
          setEmployeeStockMode('existing')
          setEmployeeStockProductId(resolvedProduct.id)
          setEmployeeStockQuantity('')
          playSuccessBeep()
          return
        }
      }

      setEmployeeStockMode('new')
      setEmployeeNewProductForm((current) => ({
        ...current,
        codigo_barras: barcodeValue,
        nombre: result.nombre || current.nombre,
        categoria: result.categoria || current.categoria,
        precio: result.precio > 0 ? String(result.precio) : current.precio,
      }))
      playSuccessBeep()
    } catch (error) {
      if (!isConnectivityError(error)) {
        playWarningBeep()
        throw error
      }
      playWarningBeep()
    } finally {
      setIsEmployeeNewProductLookupLoading(false)
    }
  }

  const submitEmployeeNewProductStock = async () => {
    const nombre = employeeNewProductForm.nombre.trim()
    const categoria = employeeNewProductForm.categoria.trim() || 'General'
    const precio = Number(employeeNewProductForm.precio || 0)
    const cantidadInicial = Number(employeeNewProductForm.cantidadInicial || 0)

    if (!nombre || precio <= 0 || cantidadInicial <= 0) return

    setIsEmployeeNewProductSaving(true)
    try {
      const created = await apiRequest<Product>('/productos/quick-import', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          nombre,
          codigo_barras: employeeNewProductForm.codigo_barras.trim() || `29${Date.now()}`.slice(0, 13),
          marca: '',
          cantidad: '',
          categoria,
          precio,
          tipo_venta: 'pieza',
          stock: 0,
        }),
      })

      setProducts((current) => [created, ...current.filter((product) => product.id !== created.id)])

      await registerInventoryOperation({
        productoId: created.id,
        tipo: 'entrada',
        cantidad: cantidadInicial,
      })
      resetEmployeeStockModal()
    } catch (error) {
      if (!isConnectivityError(error)) {
        playWarningBeep()
        throw error
      }
      playWarningBeep()
    } finally {
      setIsEmployeeNewProductSaving(false)
    }
  }

  const openAdminSection = (
    section: Section,
    options?: {
      inventoryFilter?: string
      inventorySaleType?: 'todos' | 'pieza' | 'peso'
      inventoryCategory?: string
    },
  ) => {
    if (options?.inventoryFilter !== undefined) {
      setInventoryFilter(options.inventoryFilter)
    }
    if (options?.inventorySaleType !== undefined) {
      setInventorySaleTypeFilter(options.inventorySaleType)
    }
    if (options?.inventoryCategory !== undefined) {
      setInventoryCategoryFilter(options.inventoryCategory)
    }
    setActiveSection(section)
  }

  const adminSummaryCards = [
    {
      label: 'Venta del dia',
      value: `$${adminDashboardStats.todaySalesTotal.toFixed(2)}`,
      helper: `${adminDashboardStats.todaySalesCount} ventas hoy`,
      action: 'Ver ventas',
      onClick: () => openAdminSection('ventas'),
    },
    {
      label: 'Ventas del rango',
      value: `$${adminDashboardStats.rangedSalesTotal.toFixed(2)}`,
      helper: `${adminDashboardStats.rangedSalesCount} ventas en el periodo`,
      action: 'Ir a ventas',
      onClick: () => openAdminSection('ventas'),
    },
    {
      label: 'Productos',
      value: `${adminDashboardStats.totalProducts}`,
      helper: `${adminDashboardStats.lowStockProducts.length} con stock bajo`,
      action: 'Gestionar productos',
      onClick: () => openAdminSection('productos'),
    },
    {
      label: 'Valor inventario',
      value: `$${adminDashboardStats.inventoryValue.toFixed(2)}`,
      helper: `${movements.length} movimientos`,
      action: 'Ver inventario',
      onClick: () => openAdminSection('inventario', { inventoryFilter: '', inventorySaleType: 'todos', inventoryCategory: 'todas' }),
    },
  ] as const

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.35),_transparent_30%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-3 text-slate-900 md:p-4">
      <div
        className={`mx-auto grid h-full max-w-[1760px] gap-4 ${
          showCartPanel
            ? 'grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(340px,42vh)] xl:grid-cols-[minmax(0,1fr)_400px] xl:grid-rows-1'
            : isEmployee
              ? 'grid-cols-1'
              : 'grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)]'
        }`}
      >
        {!isEmployee ? (
          <div className="hidden h-full xl:sticky xl:top-0 xl:block">
            <Sidebar role={role} activeSection={activeSection} onSectionChange={setActiveSection} currentUser={session.user} onLogout={onLogout} />
          </div>
        ) : null}

        <section className={`flex min-h-0 flex-col gap-4 ${isEmployee ? 'overflow-hidden' : 'overflow-y-auto pr-1'}`}>
          {!isEmployee ? (
            <div className="xl:hidden">
              <Sidebar role={role} activeSection={activeSection} onSectionChange={setActiveSection} currentUser={session.user} onLogout={onLogout} />
            </div>
          ) : null}

          {isEmployee ? (
            <Header
              barcode={barcode}
              onBarcodeChange={setBarcode}
              onBarcodeSubmit={handleBarcodeSubmit}
              onBarcodeKeyDown={handleBarcodeKeyDown}
              barcodeInputRef={barcodeInputRef}
            onOpenSearchModal={() => setSearchModalOpen(true)}
            currentCashier={session.user.nombre}
            matchedBarcodeProduct={matchedBarcodeProduct}
            isBarcodeLookupLoading={isBarcodeLookupLoading}
            onOpenStockEntryModal={
              isEmployee
                ? () => {
                    setEmployeeStockMode('existing')
                    setEmployeeStockProductId('')
                    setEmployeeStockQuantity('')
                    setEmployeeNewProductForm({
                      codigo_barras: '',
                      nombre: '',
                      categoria: '',
                      precio: '',
                      cantidadInicial: '',
                    })
                    setEmployeeCameraError('')
                    setEmployeeCameraOpen(false)
                    setEmployeeStockModalOpen(true)
                  }
                : undefined
            }
            showLogoutButton={isEmployee}
            onLogout={onLogout}
          />
          ) : (
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">Panel administrativo</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Resumen del negocio</h2>
                  <p className="mt-2 text-sm text-slate-500">Vista general de ventas, inventario, usuarios y movimiento operativo de la tienda.</p>
                </div>
                <div className="rounded-2xl bg-sky-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-sky-500">Usuario activo</p>
                  <p className="mt-1 text-sm font-semibold text-sky-900">{session.user.nombre}</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'dashboard' && isEmployee && (
            <div className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.32)] md:p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Zona de venta</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Caja principal</h3>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                  {filteredProducts.length} productos visibles
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      activeCategory === category
                        ? 'bg-sky-600 text-white shadow-[0_16px_30px_-22px_rgba(2,132,199,0.8)]'
                        : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {quickProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddProduct(product)}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-100"
                  >
                    {product.nombre}
                  </button>
                ))}
              </div>
              <ProductTable products={filteredProducts} onAdd={handleAddProduct} />
            </div>
          )}
          {activeSection === 'dashboard' && !isEmployee && (
            <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
              <div className="grid gap-4">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Resumen ejecutivo</p>
                      <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Indicadores clave</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: 'hoy', label: 'Hoy' },
                        { value: '7dias', label: '7 dias' },
                        { value: '30dias', label: '30 dias' },
                      ] as const).map((range) => (
                        <button
                          key={range.value}
                          type="button"
                          onClick={() => setAdminDateRange(range.value)}
                          className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                            adminDateRange === range.value
                              ? 'bg-sky-600 text-white shadow-[0_16px_30px_-22px_rgba(2,132,199,0.8)]'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                    {adminSummaryCards.map((stat) => (
                      <button
                        key={stat.label}
                        type="button"
                        onClick={stat.onClick}
                        className="min-w-0 rounded-[24px] border border-slate-100 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
                        <p className="mt-4 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{stat.value}</p>
                        <p className="mt-2 text-sm leading-5 text-slate-500">{stat.helper}</p>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">{stat.action}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Ventas recientes</p>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Actividad comercial</h3>
                      </div>
                      <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">{adminDashboardStats.recentSales.length} recientes</div>
                    </div>
                    <div className="mt-5 grid gap-3">
                      {adminDashboardStats.recentSales.map((sale) => (
                        <button
                          key={sale.id}
                          type="button"
                          onClick={() => openAdminSection('ventas')}
                          className="rounded-[22px] bg-slate-50 p-4 text-left transition hover:bg-slate-100"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">Venta #{sale.id}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">{sale.metodoPago}</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="break-words text-lg font-bold tracking-tight text-slate-950">${sale.total.toFixed(2)}</p>
                              <p className="mt-1 text-xs text-slate-500">{new Date(sale.fecha).toLocaleString()}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Usuarios</p>
                    <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Accesos del sistema</h3>
                    <div className="mt-5 space-y-3">
                      <button
                        type="button"
                        onClick={() => openAdminSection('ajustes')}
                        className="w-full rounded-[22px] bg-slate-50 p-4 text-left transition hover:bg-slate-100"
                      >
                        <p className="text-sm text-slate-500">Administradores</p>
                        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{adminDashboardStats.adminUsers}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => openAdminSection('ajustes')}
                        className="w-full rounded-[22px] bg-slate-50 p-4 text-left transition hover:bg-slate-100"
                      >
                        <p className="text-sm text-slate-500">Cajeros / vendedores</p>
                        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{adminDashboardStats.cashierUsers}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => openAdminSection('ventas')}
                        className="w-full rounded-[22px] bg-slate-50 p-4 text-left transition hover:bg-slate-100"
                      >
                        <p className="text-sm text-slate-500">Metodos de pago</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <div className="flex items-center justify-between gap-3"><span className="min-w-0">Efectivo</span><span className="break-words text-right font-semibold text-slate-900">${adminDashboardStats.salesByPaymentMethod.efectivo.toFixed(2)}</span></div>
                          <div className="flex items-center justify-between gap-3"><span className="min-w-0">Tarjeta</span><span className="break-words text-right font-semibold text-slate-900">${adminDashboardStats.salesByPaymentMethod.tarjeta.toFixed(2)}</span></div>
                          <div className="flex items-center justify-between gap-3"><span className="min-w-0">Transferencia</span><span className="break-words text-right font-semibold text-slate-900">${adminDashboardStats.salesByPaymentMethod.transferencia.toFixed(2)}</span></div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Ventas por dia</p>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Ultimos 7 dias</h3>
                      </div>
                      <p className="text-sm text-slate-500">Comparativo rapido del flujo de ventas.</p>
                    </div>

                    <div className="mt-6 grid h-64 grid-cols-7 items-end gap-3">
                      {adminDashboardStats.salesTrend.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => openAdminSection('ventas')}
                          className="flex h-full min-w-0 flex-col justify-end gap-3 text-left transition hover:opacity-90"
                        >
                          <div className="flex min-h-0 flex-1 items-end justify-center rounded-[20px] bg-slate-50 px-2 py-3">
                            <div
                              className="w-full rounded-[16px] bg-gradient-to-t from-sky-600 to-sky-400 transition-all"
                              style={{ height: `${Math.max((item.value / maxTrendValue) * 100, item.value > 0 ? 12 : 4)}%` }}
                            />
                          </div>
                          <div className="text-center">
                            <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                            <p className="mt-1 break-words text-xs font-semibold text-slate-700">${item.value.toFixed(0)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Metodos de pago</p>
                      <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Distribucion</h3>
                    </div>

                    <div className="mt-5 rounded-[24px] bg-slate-50 p-4">
                      <div className="flex h-4 overflow-hidden rounded-full bg-slate-200">
                        {paymentMethodChart.map((item) => (
                          <div
                            key={item.label}
                            className={`${item.color} h-full transition-all`}
                            style={{
                              width: `${paymentMethodTotal > 0 ? (item.value / paymentMethodTotal) * 100 : 0}%`,
                            }}
                          />
                        ))}
                      </div>

                      <div className="mt-5 space-y-3">
                        {paymentMethodChart.map((item) => {
                          const percentage = paymentMethodTotal > 0 ? (item.value / paymentMethodTotal) * 100 : 0
                          return (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => openAdminSection('ventas')}
                              className="flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-1 text-left transition hover:bg-white"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className={`h-3 w-3 rounded-full ${item.color}`} />
                                <span className="text-sm font-medium text-slate-600">{item.label}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">${item.value.toFixed(2)}</p>
                                <p className="text-xs text-slate-400">{percentage.toFixed(0)}%</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 2xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
                  <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Ventas por cajero</p>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Rendimiento del equipo</h3>
                      </div>
                    </div>
                    <div className="mt-5 space-y-3">
                      {adminDashboardStats.salesByCashier.map((cashier) => (
                        <button
                          key={cashier.id}
                          type="button"
                          onClick={() => openAdminSection('ventas')}
                          className="w-full rounded-[22px] bg-slate-50 p-4 text-left transition hover:bg-slate-100"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-900">{cashier.nombre}</p>
                              <p className="mt-1 text-xs text-slate-500">{cashier.count} ventas en el rango</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-lg font-bold tracking-tight text-slate-950">${cashier.total.toFixed(2)}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">total vendido</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Top productos</p>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Mas vendidos</h3>
                      </div>
                    </div>
                    <div className="mt-5 space-y-3">
                      {adminDashboardStats.topProducts.length > 0 ? (
                        adminDashboardStats.topProducts.map((product, index) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => openAdminSection('inventario', { inventoryFilter: product.nombre, inventorySaleType: 'todos', inventoryCategory: 'todas' })}
                            className="w-full rounded-[22px] bg-slate-50 p-4 text-left transition hover:bg-slate-100"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                                  {index + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-semibold text-slate-900">{product.nombre}</p>
                                  <p className="mt-1 text-xs text-slate-500">{product.cantidad.toFixed(3)} unidades / kg vendidos</p>
                                </div>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="text-lg font-bold tracking-tight text-slate-950">${product.total.toFixed(2)}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">ingreso generado</p>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                          No hay ventas suficientes para calcular productos destacados.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="min-w-0 rounded-[28px] border border-amber-100 bg-[linear-gradient(180deg,_#fffdf7_0%,_#ffffff_100%)] p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Inventario critico</p>
                      <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Stock bajo</h3>
                    </div>
                    <div className="w-fit rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{adminDashboardStats.lowStockProducts.length} alertas</div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {adminDashboardStats.lowStockProducts.length > 0 ? (
                      adminDashboardStats.lowStockProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => openAdminSection('inventario', { inventoryFilter: product.nombre, inventorySaleType: product.tipo_venta, inventoryCategory: getProductCategory(product) })}
                          className="w-full rounded-[22px] border border-amber-100 bg-amber-50/60 p-4 text-left transition hover:bg-amber-50"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-900">{product.nombre}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">{product.tipo_venta}</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-lg font-bold tracking-tight text-amber-700">{product.stock.toFixed(product.tipo_venta === 'peso' ? 3 : 0)}</p>
                              <p className="mt-1 text-xs text-slate-500">stock</p>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                        No hay productos con stock bajo.
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.25)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Movimientos</p>
                      <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Actividad de inventario</h3>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {adminDashboardStats.recentMovements.map((movement) => {
                      const product = products.find((item) => item.id === movement.productoId)
                      return (
                        <button
                          key={movement.id}
                          type="button"
                          onClick={() => openAdminSection('inventario', { inventoryFilter: product?.nombre || '', inventorySaleType: 'todos', inventoryCategory: 'todas' })}
                          className="w-full rounded-[22px] bg-slate-50 p-4 text-left transition hover:bg-slate-100"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-900">{product?.nombre || `Producto #${movement.productoId}`}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">{movement.tipo}</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-sm font-semibold text-slate-900">{movement.cantidad.toFixed(3)}</p>
                              <p className="mt-1 text-xs text-slate-500">{new Date(movement.fecha).toLocaleString()}</p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeSection === 'ventas' && (
            <SalesSummary
              sales={sales}
              users={users}
              role={role}
              currentUser={session.user}
              cashCuts={cashCuts}
              onCreateCashCut={createCashCut}
            />
          )}
          {activeSection === 'productos' && role === 'admin' && <ProductsManager products={products} onCreate={createProduct} onUpdate={updateProduct} onDelete={deleteProduct} onLookupByBarcode={lookupProductByBarcode} onOpenInventoryProduct={openInventoryForProduct} onGenerateBarcodePdf={generateProductBarcodePdf} />}
          {activeSection === 'inventario' && (
            <InventoryTable
              products={filteredInventory}
              movements={movements}
              role={role}
              filter={inventoryFilter}
              onFilterChange={setInventoryFilter}
              saleTypeFilter={inventorySaleTypeFilter}
              onSaleTypeFilterChange={setInventorySaleTypeFilter}
              categoryFilter={inventoryCategoryFilter}
              onCategoryFilterChange={setInventoryCategoryFilter}
              availableCategories={inventoryCategories}
              onInventoryOperation={registerInventoryOperation}
            />
          )}
          {activeSection === 'ajustes' && role === 'admin' && <SettingsPanel users={users} onCreateUser={createUser} onUpdateUser={updateUser} />}
        </section>

        {showCartPanel ? (
          <CartPanel items={cartItems} onIncrease={(productId) => updatePieceQuantity(productId, 1)} onDecrease={(productId) => updatePieceQuantity(productId, -1)} onRemove={removeCartItem} onWeightValueChange={updateWeightItemValue} onWeightPresetSelect={applyWeightPresetToCartItem} onCheckout={openPaymentModal} />
        ) : null}
      </div>

      {searchModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="flex h-[min(78vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_40px_90px_-50px_rgba(15,23,42,0.45)]">
            <div className="border-b border-slate-100 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Busqueda de productos</p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Buscar por coincidencia</h3>
                </div>
                <button type="button" onClick={() => { setSearchModalOpen(false); setSearchQuery(''); }} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200">Cerrar</button>
              </div>
              <div className="mt-5 flex gap-3">
                <input
                  ref={modalSearchInputRef}
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setHighlightedMatchIndex(0)
                  }}
                  onKeyDown={handleSearchModalKeyDown}
                  placeholder="Escribe nombre, marca, categoria o codigo..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none focus:border-sky-300"
                />
                <button type="button" onClick={handleSearchModalSubmit} className="rounded-2xl bg-sky-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-sky-700">Agregar</button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-3">
                {searchMatches.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectSearchMatch(product)}
                    className={`flex items-center justify-between rounded-[24px] border px-4 py-4 text-left transition ${
                      highlightedMatch?.id === product.id
                        ? 'border-sky-200 bg-sky-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{product.nombre}</p>
                      <p className="mt-1 text-xs font-mono text-slate-400">{product.codigo_barras}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">${product.precio.toFixed(2)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{product.tipo_venta}</p>
                    </div>
                  </button>
                ))}
                {searchMatches.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No hay coincidencias para esta busqueda.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {employeeStockModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_40px_90px_-50px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Empleado caja</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Registrar entrada de stock</h3>
                <p className="mt-2 text-sm text-slate-500">Ingresa piezas a un producto existente o crea uno nuevo desde codigo de barras sin salir de caja.</p>
              </div>
              <button
                type="button"
                onClick={resetEmployeeStockModal}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-6 flex gap-2 rounded-[24px] bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setEmployeeStockMode('existing')
                  setEmployeeCameraOpen(false)
                  setEmployeeCameraError('')
                }}
                className={`flex-1 rounded-[20px] px-4 py-3 text-sm font-semibold transition ${employeeStockMode === 'existing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Existente
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmployeeStockMode('new')
                  setEmployeeStockProductId('')
                  setEmployeeStockQuantity('')
                }}
                className={`flex-1 rounded-[20px] px-4 py-3 text-sm font-semibold transition ${employeeStockMode === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Nuevo
              </button>
            </div>

            {employeeStockMode === 'existing' ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Producto existente</span>
                    <select
                      value={employeeStockProductId}
                      onChange={(event) => setEmployeeStockProductId(event.target.value ? Number(event.target.value) : '')}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                    >
                      <option value="">Selecciona un producto</option>
                      {products
                        .slice()
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.nombre}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      {employeeSelectedProduct?.tipo_venta === 'peso' ? 'Cantidad en kg' : 'Cantidad en piezas'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step={employeeSelectedProduct?.tipo_venta === 'peso' ? '0.001' : '1'}
                      value={employeeStockQuantity}
                      onChange={(event) => setEmployeeStockQuantity(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                    />
                  </label>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {employeeSelectedProduct ? (
                    <>
                      <p className="font-semibold text-slate-900">{employeeSelectedProduct.nombre}</p>
                      <p className="mt-1 text-xs font-mono text-slate-400">{employeeSelectedProduct.codigo_barras}</p>
                      <div className="mt-4 space-y-2">
                        <p>
                          Stock actual:{' '}
                          <span className="font-semibold text-slate-900">
                            {employeeSelectedProduct.stock.toFixed(employeeSelectedProduct.tipo_venta === 'peso' ? 3 : 0)}
                          </span>
                        </p>
                        <p>
                          Tipo:{' '}
                          <span className="font-semibold text-slate-900">
                            {employeeSelectedProduct.tipo_venta === 'peso' ? 'A granel' : 'Pieza'}
                          </span>
                        </p>
                        {employeeSelectedProduct.categoria ? (
                          <p>
                            Categoria: <span className="font-semibold text-slate-900">{employeeSelectedProduct.categoria}</span>
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Selecciona un producto para revisar stock actual y registrar la entrada.</p>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <button
                    type="button"
                    onClick={() => void submitEmployeeStockEntry()}
                    disabled={!employeeSelectedProduct || Number(employeeStockQuantity || 0) <= 0 || isEmployeeStockSaving}
                    className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isEmployeeStockSaving ? 'Guardando...' : 'Registrar entrada'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Codigo de barras</span>
                    <input
                      value={employeeNewProductForm.codigo_barras}
                      onChange={(event) =>
                        setEmployeeNewProductForm((current) => ({
                          ...current,
                          codigo_barras: event.target.value,
                          nombre: '',
                          categoria: '',
                          precio: '',
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void lookupEmployeeNewProductBarcode()
                        }
                      }}
                      placeholder="Escanear o capturar codigo"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void lookupEmployeeNewProductBarcode()}
                    disabled={!employeeNewProductForm.codigo_barras.trim() || isEmployeeNewProductLookupLoading}
                    className="self-end rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isEmployeeNewProductLookupLoading ? 'Consultando...' : 'Consultar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeCameraError('')
                      setEmployeeCameraOpen(true)
                    }}
                    className="self-end rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Abrir camara
                  </button>
                </div>

                {employeeCameraOpen ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Escaner con camara</p>
                        <p className="mt-1 text-xs text-slate-500">Apunta al codigo. Cuando se detecte, se consultara automaticamente.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEmployeeCameraOpen(false)
                          stopEmployeeCamera()
                        }}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        Cerrar camara
                      </button>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-[24px] bg-slate-900">
                      <video ref={employeeCameraVideoRef} autoPlay muted playsInline className="aspect-[16/10] w-full object-cover" />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{employeeCameraError || 'Esperando lectura de codigo...'}</p>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Nombre</span>
                    <input
                      value={employeeNewProductForm.nombre}
                      onChange={(event) => setEmployeeNewProductForm((current) => ({ ...current, nombre: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Categoria</span>
                    <input
                      value={employeeNewProductForm.categoria}
                      onChange={(event) => setEmployeeNewProductForm((current) => ({ ...current, categoria: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                      placeholder="Bebidas, dulces, botanas..."
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Precio</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={employeeNewProductForm.precio}
                      onChange={(event) => setEmployeeNewProductForm((current) => ({ ...current, precio: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Cantidad inicial</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={employeeNewProductForm.cantidadInicial}
                      onChange={(event) => setEmployeeNewProductForm((current) => ({ ...current, cantidadInicial: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                    />
                  </label>
                </div>

                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Si el codigo ya existe en tu catalogo, al consultar el sistema cambia a la pestaña de producto existente para registrar solo la entrada.
                </div>

                <button
                  type="button"
                  onClick={() => void submitEmployeeNewProductStock()}
                  disabled={
                    isEmployeeNewProductSaving ||
                    isEmployeeNewProductLookupLoading ||
                    !employeeNewProductForm.nombre.trim() ||
                    Number(employeeNewProductForm.precio || 0) <= 0 ||
                    Number(employeeNewProductForm.cantidadInicial || 0) <= 0
                  }
                  className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isEmployeeNewProductSaving ? 'Guardando...' : 'Guardar producto e ingresar stock'}
                </button>
              </div>
            )}

            {employeeCameraError && !employeeCameraOpen ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{employeeCameraError}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {weightModalProduct ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_40px_90px_-50px_rgba(15,23,42,0.45)]"><p className="text-xs uppercase tracking-[0.22em] text-slate-400">Producto por peso</p><h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{weightModalProduct.nombre}</h3><p className="mt-2 text-sm text-slate-500">Captura por gramaje. El precio mostrado es por kilo.</p><div className="mt-5 space-y-4"><input type="number" min="0" step="1" value={weightValue} onChange={(event) => setWeightValue(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none focus:border-sky-300" placeholder="Gramos" /><div className="flex flex-wrap gap-2">{weightPresets.map((preset) => <button key={preset.label} type="button" onClick={() => applyWeightPreset(preset.value)} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200">{preset.label}</button>)}</div><div className="grid grid-cols-2 gap-2 text-xs uppercase tracking-[0.16em] text-slate-400"><div className="rounded-2xl bg-slate-50 px-3 py-2">Precio kilo: <span className="font-semibold text-slate-700">${weightModalProduct.precio.toFixed(2)}</span></div><div className="rounded-2xl bg-slate-50 px-3 py-2">Precio cuarto: <span className="font-semibold text-slate-700">${(weightModalProduct.precio * 0.25).toFixed(2)}</span></div></div></div><div className="mt-6 flex gap-3"><button type="button" onClick={() => setWeightModalProduct(null)} className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200">Cancelar</button><button type="button" onClick={addWeightProduct} className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600">Agregar</button></div></div></div> : null}

      {quickImportProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_40px_90px_-50px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Alta rapida</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Producto nuevo detectado</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickImportProduct(null)
                  setQuickImportPrice('0')
                  setQuickImportCategory('')
                }}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 rounded-[24px] bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{quickImportProduct.nombre}</p>
              <p className="mt-1 text-xs font-mono text-slate-500">{quickImportProduct.codigo_barras}</p>
              <p className="mt-2 text-sm text-slate-600">
                {[quickImportProduct.marca, quickImportProduct.cantidad, quickImportProduct.categoria].filter(Boolean).join(' · ') || 'Sin detalle'}
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <p className="mb-2 text-sm font-semibold text-slate-700">Precio</p>
                <input
                  ref={quickImportPriceRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={quickImportPrice}
                  onChange={(event) => setQuickImportPrice(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                />
              </label>
              <label className="block">
                <p className="mb-2 text-sm font-semibold text-slate-700">Categoria</p>
                <input
                  type="text"
                  value={quickImportCategory}
                  onChange={(event) => setQuickImportCategory(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-300"
                />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setQuickImportProduct(null)
                  setQuickImportPrice('0')
                  setQuickImportCategory('')
                }}
                className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void quickImportProductFromCashier()}
                disabled={isQuickImportSaving}
                className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isQuickImportSaving ? 'Guardando...' : 'Guardar y agregar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_40px_90px_-50px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Cobrar venta</p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Pago en efectivo</h3>
              </div>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalOpen(false)
                    setPaymentMethod('efectivo')
                    setPaymentAmount('')
                  }}
                  className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-3 rounded-[24px] bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Total a cobrar</span>
                <span className="text-2xl font-bold tracking-tight text-slate-950">${total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Impuestos</span>
                <span className="font-semibold text-slate-800">${taxes.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-4 flex flex-wrap gap-2">
                {([
                  { value: 'efectivo', label: 'Efectivo' },
                  { value: 'tarjeta', label: 'Tarjeta' },
                  { value: 'transferencia', label: 'Transferencia' },
                ] as const).map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method.value)
                      if (method.value !== 'efectivo') {
                        setPaymentAmount(total.toFixed(2))
                      }
                    }}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      paymentMethod === method.value
                        ? 'bg-sky-600 text-white shadow-[0_16px_30px_-22px_rgba(2,132,199,0.8)]'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>

              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Con cuanto paga</label>
              <input
                ref={paymentInputRef}
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleCheckout()
                  }
                }}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-semibold text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
                placeholder="0.00"
                disabled={!requiresCashAmount}
              />
            </div>

            <div className="mt-5 grid gap-3">
              {requiresCashAmount ? (
                <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Cambio</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-700">${change.toFixed(2)}</p>
                </div>
              ) : (
                <div className="rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Metodo de pago</p>
                  <p className="mt-2 text-xl font-bold tracking-tight capitalize text-sky-700">{paymentMethod}</p>
                </div>
              )}
              {requiresCashAmount && paymentShortfall > 0 ? (
                <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                  Faltan ${paymentShortfall.toFixed(2)} para completar la venta.
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentModalOpen(false)
                  setPaymentMethod('efectivo')
                  setPaymentAmount('')
                }}
                className="w-full rounded-2xl bg-slate-100 px-4 py-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCheckout()}
                disabled={requiresCashAmount && paymentReceived < total}
                className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                Confirmar cobro
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
