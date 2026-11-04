import { useState, useSyncExternalStore } from 'react'
import { approveWaste, findBattery, reportOutOfService, resetDemo, update, useBatteries } from './store.js'

const ROLES = {
  garage: { label: 'Garage', device: 'Tablet', text: 'Scan a battery, review it and report it out of service.' },
  owner: { label: 'Passport Owner', device: 'Desktop', text: 'Handle garage requests and update passport status.' },
  sorting: { label: 'Sorting Centre', device: 'Mobile', text: 'Scan a received battery and check its status.' },
}

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' })
const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

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
  const { role, batteryId } = useRoute()
  const batteries = useBatteries()
  const battery = batteries.find((b) => b.batteryId === batteryId)

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/">Battery Passport</a>
        {role && (
          <span className="topbar-role">
            {ROLES[role].label} · <a href="#/">Switch role</a>
          </span>
        )}
      </header>
      <main className={role === 'owner' ? 'page page-wide' : 'page'}>
        {!role && <Home />}
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
    </>
  )
}

function Home() {
  return (
    <>
      <h1>Choose your role</h1>
      <p className="muted">Open each role in its own browser tab: updates appear in the others instantly.</p>
      <div className="role-grid">
        {Object.entries(ROLES).map(([key, role]) => (
          <a className="card role-card" href={`#/${key}`} key={key}>
            <span className="eyebrow">{role.device}</span>
            <strong>{role.label}</strong>
            <span className="muted">{role.text}</span>
          </a>
        ))}
      </div>
      <button className="button-ghost" onClick={resetDemo}>Reset demo data</button>
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
