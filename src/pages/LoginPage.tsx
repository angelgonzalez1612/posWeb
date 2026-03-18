import { useState } from 'react'

type LoginPageProps = {
  onLogin: (credentials: { email: string; password: string }) => Promise<void>
  error: string
  loading: boolean
}

export function LoginPage({ onLogin, error, loading }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.32),_transparent_28%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4">
      <section className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.35)]">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-500">Tienda POS</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Iniciar sesion</h1>

        <form
          className="mt-8 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onLogin({ email, password })
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Correo</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none focus:border-sky-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Contrasena</span>
            <div className="flex rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-sky-300">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-l-2xl bg-transparent px-4 py-4 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="rounded-r-2xl px-4 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full rounded-2xl bg-sky-600 px-4 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
