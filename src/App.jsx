import { useEffect, useState, useSyncExternalStore } from 'react'
import qrcode from 'qrcode-generator'
import { demoLogIn, logIn, logOut, ROLES, signUp, useSession } from './auth.js'
import { approveWaste, findBattery, reportOutOfService, resetDemo, update, useBatteries } from './store.js'

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' })
const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

function qrDataUrl(text) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createDataURL(8, 32)
}

function useRoute() {
  const hash = useSyncExternalStore(
    (listener) => {
      window.addEventListener('hashchange', listener)
      return () => window.removeEventListener('hashchange', listener)
    },
    () => window.location.hash,
  )
  const [role, batteryId] = hash.replace(/^#\/?/, '').split('/')
  return { role: ROLES[role] ? role : null, batteryId }
}

export default function App() {
  const session = useSession()
  const route = useRoute()
  const batteries = useBatteries()
  const [demoOpen, setDemoOpen] = useState(false)
  const role = session?.role
  const wrongRoute = session && route.role !== role
  const batteryId = wrongRoute ? undefined : route.batteryId
  const battery = batteries.find((b) => b.batteryId === batteryId)

  // Each account only reaches its own role, whatever the URL says.
  useEffect(() => {
    if (wrongRoute) window.location.replace(`#/${role}`)
  }, [wrongRoute, role])

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/">Battery Passport</a>
        <div className="topbar-actions">
          {session && (
            <span className="topbar-role">
              {session.email} · {ROLES[role].label} ·{' '}
              <button className="button-link" onClick={logOut}>Log out</button>
            </span>
          )}
          {/* Team testing tool: only in `npm run dev`, left out of production builds. */}
          {import.meta.env.DEV && (
            <button className="button-ghost button-small" onClick={() => setDemoOpen(!demoOpen)}>
              {demoOpen ? 'Close demo mode' : 'Demo mode'}
            </button>
          )}
        </div>
      </header>
      {import.meta.env.DEV && demoOpen ? (
        <main className="page">
          <DemoMode onPick={() => setDemoOpen(false)} />
        </main>
      ) : (
        <main className={role === 'owner' ? 'page page-wide' : 'page'}>
          {!session && <Auth />}
          {role === 'manufacturer' && <Manufacturer batteries={batteries} />}
          {role === 'owner' && <Owner batteries={batteries} selected={battery} />}
          {(role === 'garage' || role === 'sorting') && !batteryId && (
            <Scan role={role} batteries={batteries} />
          )}
          {(role === 'garage' || role === 'sorting') && batteryId && !battery && (
            <NotFound role={role} />
          )}
          {role === 'garage' && battery && <Garage battery={battery} />}
          {role === 'sorting' && battery && <Sorting battery={battery} />}
        </main>
      )}
    </>
  )
}

function DemoMode({ onPick }) {
  return (
    <div className="auth">
      <h1>Demo mode</h1>
      <p className="muted">For testing: choose a role to enter without logging in.</p>
      {Object.entries(ROLES).map(([key, option]) => (
        <a
          className="card label"
          href={`#/${key}`}
          key={key}
          onClick={() => {
            demoLogIn(key)
            onPick()
          }}
        >
          <strong>{option.label}</strong>
          <span className="muted">{option.text}</span>
        </a>
      ))}
    </div>
  )
}

function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isSignUp) await signUp({ email, password, role })
      else await logIn(email, password)
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <h1>{isSignUp ? 'Create account' : 'Log in'}</h1>
      <form className="card form" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          minLength={isSignUp ? 8 : undefined}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {isSignUp && <p className="muted">At least 8 characters.</p>}
        {isSignUp && (
          <fieldset>
            <legend>Account type</legend>
            {Object.entries(ROLES).map(([key, option]) => (
              <label className="radio" key={key}>
                <input
                  type="radio"
                  name="role"
                  value={key}
                  checked={role === key}
                  onChange={() => setRole(key)}
                  required
                />
                <span>
                  <strong>{option.label}</strong>
                  <span className="muted">{option.text}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>{isSignUp ? 'Create account' : 'Log in'}</button>
      </form>
      <p>
        {isSignUp ? 'Already have an account? ' : 'New here? '}
        <button
          className="button-link"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError('')
          }}
        >
          {isSignUp ? 'Log in' : 'Create an account'}
        </button>
      </p>
      <button className="button-ghost" onClick={resetDemo}>Reset demo data</button>
    </div>
  )
}

function Manufacturer({ batteries }) {
  const [code, setCode] = useState('')
  const [battery, setBattery] = useState(null)
  const [notFound, setNotFound] = useState(false)

  function submit(event) {
    event.preventDefault()
    const found = findBattery(batteries, code)
    setBattery(found ?? null)
    setNotFound(!found)
  }

  return (
    <>
      <h1>Generate QR code</h1>
      <form className="card form" onSubmit={submit}>
        <label htmlFor="passport">Passport ID</label>
        <div className="form-row">
          <input
            id="passport"
            list="passports"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setNotFound(false)
            }}
            placeholder="BP-FR-7F3A91"
            required
          />
          <datalist id="passports">
            {batteries.map((b) => (
              <option value={b.batteryPassportId} key={b.batteryId}>{b.batteryId}</option>
            ))}
          </datalist>
          <button>Generate QR code</button>
        </div>
        {notFound && <p className="error" role="alert">No battery found with this ID.</p>}
      </form>
      {battery && (
        <section className="card qr">
          <img
            src={qrDataUrl(battery.batteryPassportId)}
            alt={`QR code for passport ${battery.batteryPassportId}`}
          />
          <strong>{battery.batteryPassportId}</strong>
          <span className="muted">{battery.batteryId} · {battery.model.name}</span>
        </section>
      )}
    </>
  )
}

function Scan({ role, batteries }) {
  const [code, setCode] = useState('')
  const [notFound, setNotFound] = useState(false)

  function submit(event) {
    event.preventDefault()
    const battery = findBattery(batteries, code)
    if (battery) window.location.hash = `#/${role}/${battery.batteryId}`
    else setNotFound(true)
  }

  return (
    <>
      <h1>Scan battery QR code</h1>
      <p className="muted">Demo: scanning is simulated. Pick a label or enter its ID.</p>
      <div className="label-grid">
        {batteries.map((b) => (
          <a className="card label" href={`#/${role}/${b.batteryId}`} key={b.batteryId}>
            <strong>{b.batteryId}</strong>
            <span className="muted">{b.model.name}</span>
          </a>
        ))}
      </div>
      <form className="card form" onSubmit={submit}>
        <label htmlFor="code">Battery or passport ID</label>
        <div className="form-row">
          <input
            id="code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setNotFound(false)
            }}
            placeholder="BP-FR-7F3A91"
            required
          />
          <button>Open passport</button>
        </div>
        {notFound && <p className="error" role="alert">No battery found with this ID.</p>}
      </form>
    </>
  )
}

function NotFound({ role }) {
  return (
    <>
      <h1>Battery not found</h1>
      <a href={`#/${role}`}>Scan another battery</a>
    </>
  )
}

function Garage({ battery }) {
  const [reason, setReason] = useState('')

  function submit(event) {
    event.preventDefault()
    update((batteries) => reportOutOfService(batteries, battery.batteryId, reason.trim()))
  }

  return (
    <>
      <BatteryTitle battery={battery} backTo="#/garage" />
      {battery.status === 'Waste' && (
        <Banner tone="danger" title="Out of service">
          This passport is set to Waste. Hand the battery over for transfer to the sorting centre.
        </Banner>
      )}
      {battery.request && (
        <Banner tone="info" title="Request sent to the Passport Owner">
          Waiting for the status change from Original to Waste.
        </Banner>
      )}
      {battery.status === 'Original' && !battery.request && (
        <form className="card form" onSubmit={submit}>
          <h2>Report out of service</h2>
          <label htmlFor="reason">Diagnosis</label>
          <textarea
            id="reason"
            rows="3"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Describe the critical defect"
            required
          />
          <button className="button-danger" disabled={!reason.trim()}>
            Notify Passport Owner
          </button>
        </form>
      )}
      <div className="details-grid">
        <Identification battery={battery} />
        <KeyParameters battery={battery} />
      </div>
      <History battery={battery} />
    </>
  )
}

function Owner({ batteries, selected }) {
  const requests = batteries.filter((b) => b.request)

  return (
    <>
      <h1>Battery passports</h1>
      <section className="card" aria-labelledby="notifications">
        <h2 id="notifications">Notifications ({requests.length})</h2>
        {requests.length === 0 && <p className="muted">No pending requests.</p>}
        {requests.map((b) => (
          <div className="request" key={b.batteryId}>
            <div>
              <strong>Garage requests Original → Waste for {b.batteryId}</strong>
              <p>{b.request.reason}</p>
              <p className="muted">{formatDateTime(b.request.at)}</p>
            </div>
            <button
              className="button-danger"
              onClick={() => update((all) => approveWaste(all, b.batteryId))}
            >
              Change status to Waste
            </button>
          </div>
        ))}
      </section>
      <section className="card">
        <h2>All batteries</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Battery</th>
                <th>Passport</th>
                <th>Model</th>
                <th>SOH</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {batteries.map((b) => (
                <tr key={b.batteryId} className={b === selected ? 'row-selected' : undefined}>
                  <td><a href={`#/owner/${b.batteryId}`}>{b.batteryId}</a></td>
                  <td>{b.batteryPassportId}</td>
                  <td>{b.model.name}</td>
                  <td>{b.performance.soh}%</td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <>
          <h2 className="section-title">{selected.batteryId}</h2>
          <div className="details-grid">
            <Identification battery={selected} />
            <KeyParameters battery={selected} />
            <Composition battery={selected} />
          </div>
          <History battery={selected} />
        </>
      )}
    </>
  )
}

function Sorting({ battery }) {
  return (
    <>
      <BatteryTitle battery={battery} backTo="#/sorting" />
      {battery.status === 'Waste' ? (
        <Banner tone="success" title="Passport up to date">
          Status is Waste, as expected for a battery received by the sorting centre.
        </Banner>
      ) : (
        <Banner tone="warning" title="Passport not up to date">
          Status is {battery.status}, expected Waste. Contact the Passport Owner.
        </Banner>
      )}
      <div className="details-grid">
        <Identification battery={battery} />
        <Composition battery={battery} />
        <KeyParameters battery={battery} />
      </div>
      <History battery={battery} />
    </>
  )
}

function BatteryTitle({ battery, backTo }) {
  return (
    <>
      <a href={backTo}>← Scan another battery</a>
      <div className="title-row">
        <h1>{battery.batteryId}</h1>
        <StatusBadge status={battery.status} />
      </div>
    </>
  )
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>
}

function Banner({ tone, title, children }) {
  return (
    <div className={`banner banner-${tone}`} role="status">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  )
}

function Facts({ title, facts }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <dl>
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Identification({ battery }) {
  return (
    <Facts
      title="Identification"
      facts={[
        ['Passport ID', battery.batteryPassportId],
        ['Model', `${battery.model.name} (${battery.model.modelId})`],
        ['Type', battery.model.type],
        ['Operator', `${battery.operator.name}, ${battery.operator.country}`],
        ['Contact', battery.operator.email],
      ]}
    />
  )
}

function KeyParameters({ battery }) {
  const { performance, durability, model } = battery
  return (
    <Facts
      title="Key parameters"
      facts={[
        ['State of health', `${performance.soh}%`],
        ['State of charge', `${performance.soc}%`],
        ['Voltage (min / nominal / max)', `${model.voltage.minimal} / ${model.voltage.nominal} / ${model.voltage.maximal} V`],
        ['Expected lifetime', `${model.expectedLifetimeCycles} cycles`],
        ['Warranty until', formatDate(durability.warrantyUntil)],
        ['Recorded accidents', durability.accidents],
      ]}
    />
  )
}

function Composition({ battery }) {
  const { composition, carbonFootprint, extinguishingAgent } = battery.model
  return (
    <Facts
      title="Composition and handling"
      facts={[
        ['Chemistry', composition.chemistry],
        ['Anode', composition.anode],
        ['Cathode', composition.cathode],
        ['Electrolyte', composition.electrolyte],
        ['Extinguishing agent', extinguishingAgent],
        ['Carbon footprint', `${carbonFootprint.declared} kg CO₂/kWh (class ${carbonFootprint.performanceClass})`],
      ]}
    />
  )
}

function History({ battery }) {
  return (
    <section className="card">
      <h2>History</h2>
      <ol className="history">
        {[...battery.history].reverse().map((event, index) => (
          <li key={index}>
            <span>{event.text}</span>
            <span className="muted">{event.actor} · {formatDateTime(event.at)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
