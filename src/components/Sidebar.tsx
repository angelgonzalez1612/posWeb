import type { Role, Section, User } from '../types'

type SidebarProps = {
  role: Role
  activeSection: Section
  onSectionChange: (section: Section) => void
  currentUser: User
  onLogout: () => void
}

const sectionsByRole: Record<Role, Section[]> = {
  vendedor: ['dashboard', 'ventas', 'inventario'],
  admin: ['dashboard', 'ventas', 'productos', 'inventario', 'ajustes'],
}

const labels: Record<Section, string> = {
  dashboard: 'Dashboard',
  ventas: 'Ventas',
  productos: 'Productos',
  inventario: 'Inventario',
  ajustes: 'Ajustes',
}

const roleLabel: Record<Role, string> = {
  admin: 'Administrador',
  vendedor: 'Empleado',
}

export function Sidebar({ role, activeSection, onSectionChange, currentUser, onLogout }: SidebarProps) {
  return (
    <aside className="flex min-h-full w-full flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)] lg:w-[250px]">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-lg font-extrabold text-sky-700">TP</div>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Sistema POS</p>
          <h1 className="text-lg font-bold text-slate-900">Tienda POS</h1>
        </div>
      </div>

      <div className="mb-6 rounded-[24px] bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Sesion actual</p>
        <p className="mt-3 text-sm font-semibold text-slate-900">{currentUser.nombre}</p>
        <p className="mt-1 text-sm text-slate-500">{currentUser.email}</p>
        <p className="mt-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">{roleLabel[role]}</p>
      </div>

      <nav className="space-y-2">
        {sectionsByRole[role].map((section, index) => {
          const active = section === activeSection
          return (
            <button key={section} type="button" onClick={() => onSectionChange(section)} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${active ? 'bg-sky-600 text-white shadow-[0_18px_40px_-24px_rgba(2,132,199,0.9)]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
              <span>{labels[section]}</span>
              <span className={`text-xs ${active ? 'text-sky-100' : 'text-slate-300'}`}>0{index + 1}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto rounded-[24px] bg-slate-50 p-4">
        <button type="button" onClick={onLogout} className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">Cerrar sesion</button>
      </div>
    </aside>
  )
}
