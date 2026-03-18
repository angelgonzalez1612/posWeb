import { useMemo, useState } from 'react'
import type { Role, User } from '../types'

type SettingsPanelProps = {
  users: User[]
  onCreateUser: (payload: { nombre: string; email: string; rol: Role; password: string }) => void
  onUpdateUser: (userId: number, payload: { nombre?: string; email?: string; rol?: Role; password?: string }) => void
}

export function SettingsPanel({ users, onCreateUser, onUpdateUser }: SettingsPanelProps) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'todos'>('todos')
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', email: '', rol: 'vendedor' as Role, password: '' })
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    rol: 'vendedor' as Role,
    password: 'changeme123',
  })

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter((user) => {
      const matchesRole = roleFilter === 'todos' ? true : user.rol === roleFilter
      const matchesQuery = query
        ? [user.nombre, user.email, user.rol].join(' ').toLowerCase().includes(query)
        : true
      return matchesRole && matchesQuery
    })
  }, [roleFilter, search, users])

  const totals = useMemo(
    () => ({
      all: users.length,
      admins: users.filter((user) => user.rol === 'admin').length,
      sellers: users.filter((user) => user.rol === 'vendedor').length,
    }),
    [users],
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-3">
        {[
          { label: 'Usuarios totales', value: `${totals.all}`, helper: 'Cuentas registradas en el sistema' },
          { label: 'Administradores', value: `${totals.admins}`, helper: 'Acceso completo al panel' },
          { label: 'Vendedores', value: `${totals.sellers}`, helper: 'Acceso operativo de caja' },
        ].map((item) => (
          <article key={item.label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{item.value}</p>
            <p className="mt-2 text-sm text-slate-500">{item.helper}</p>
          </article>
        ))}
      </div>

      <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Ajustes</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Crear usuario</h3>
          <div className="mt-5 space-y-4">
            <input
              value={form.nombre}
              onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
              placeholder="Nombre completo"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300"
            />
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300"
            />
            <input
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Password inicial"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300"
            />
            <select
              value={form.rol}
              onChange={(event) => setForm((current) => ({ ...current, rol: event.target.value as Role }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={() => {
                onCreateUser(form)
                setForm({ nombre: '', email: '', rol: 'vendedor', password: 'changeme123' })
              }}
              className="w-full rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-emerald-600"
            >
              Crear usuario
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Usuarios</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Gestion de acceso</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,280px)_180px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre o email..."
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300"
              />
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as Role | 'todos')}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-300"
              >
                <option value="todos">Todos</option>
                <option value="admin">Admin</option>
                <option value="vendedor">Vendedor</option>
              </select>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {filteredUsers.map((user) => {
              const isEditing = editingUserId === user.id

              return (
                <article key={user.id} className="rounded-[24px] bg-slate-50 p-4">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={editForm.nombre}
                          onChange={(event) => setEditForm((current) => ({ ...current, nombre: event.target.value }))}
                          placeholder="Nombre"
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300"
                        />
                        <input
                          value={editForm.email}
                          onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                          placeholder="Email"
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300"
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <select
                          value={editForm.rol}
                          onChange={(event) => setEditForm((current) => ({ ...current, rol: event.target.value as Role }))}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300"
                        >
                          <option value="vendedor">Vendedor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <input
                          value={editForm.password}
                          onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))}
                          placeholder="Nueva password opcional"
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateUser(user.id, {
                              nombre: editForm.nombre,
                              email: editForm.email,
                              rol: editForm.rol,
                              password: editForm.password || undefined,
                            })
                            setEditingUserId(null)
                            setEditForm({ nombre: '', email: '', rol: 'vendedor', password: '' })
                          }}
                          className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                        >
                          Guardar cambios
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserId(null)
                            setEditForm({ nombre: '', email: '', rol: 'vendedor', password: '' })
                          }}
                          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{user.nombre}</p>
                        <p className="mt-1 truncate text-sm text-slate-500">{user.email}</p>
                        <p className="mt-2 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                          {user.rol}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(['admin', 'vendedor'] as Role[]).map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => onUpdateUser(user.id, { rol: role })}
                            className={`rounded-2xl px-4 py-3 text-sm font-semibold capitalize transition ${
                              user.rol === role ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserId(user.id)
                            setEditForm({
                              nombre: user.nombre,
                              email: user.email,
                              rol: user.rol,
                              password: '',
                            })
                          }}
                          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}

            {filteredUsers.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
                No hay usuarios que coincidan con los filtros.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
