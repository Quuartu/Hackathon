import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import jsQR from 'jsqr'
import qrcode from 'qrcode-generator'
import { demoLogIn, logIn, logOut, ROLES, signUp, useSession } from './auth.js'
import { addScan, applyTelemetry, approveWaste, createBattery, findBattery, nextBatteryIds, refresh, reportOutOfService, sendTelemetry, useBatteries } from './store.js'

// The database stores some dates as year and month only, like 2033-06.
const isMonth = (iso) => iso.length === 7
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(
    'en-GB',
    isMonth(iso) ? { month: 'short', year: 'numeric', timeZone: 'UTC' } : { dateStyle: 'medium' },
  )
const formatDateTime = (iso) =>
  isMonth(iso)
    ? formatDate(iso)
    : new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

function qrDataUrl(text) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createDataURL(8, 32)
}

const MAX_QR_IMAGE_SIZE = 1000
const CAMERA_SCAN_MS = 200

// Reads a QR code from a video frame or an image, scaling big photos down first.
function readQr(source, width, height) {
  const scale = Math.min(1, MAX_QR_IMAGE_SIZE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(data, canvas.width, canvas.height)?.data
}

const SCANNING_ROLES = ['garage', 'customer', 'sorting']

function useRoute() {
  const hash = useSyncExternalStore(
    (listener) => {
      window.addEventListener('hashchange', listener)
      return () => window.removeEventListener('hashchange', listener)
    },
    () => window.location.hash,
  )
  const [role, passportId] = hash.replace(/^#\/?/, '').split('/')
  return { role: ROLES[role] ? role : null, passportId }
}

export default function App() {
  const session = useSession()
  const route = useRoute()
  const { batteries, companies, scans, error } = useBatteries()
  const [demoOpen, setDemoOpen] = useState(false)
  const role = session?.role
  const wrongRoute = session && route.role !== role
  const passportId = wrongRoute ? undefined : route.passportId
  const scanning = SCANNING_ROLES.includes(role)
  const token = session?.token

  // Loads this account's list straight after login, and clears it after logout.
  useEffect(() => {
    refresh()
  }, [token])

  // These roles only open batteries they have scanned, even from a direct URL.
  const canOpen = !scanning || scans.includes(passportId)
  const battery = canOpen ? batteries?.find((b) => b.batteryPassportId === passportId) : undefined

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
        <main className={role === 'manufacturer' ? 'page page-wide' : 'page'}>
          {!session && <Auth />}
          {session && error && <Banner tone="danger" title="Data problem">{error}</Banner>}
          {session && !batteries && !error && <p className="muted" role="status">Loading passports…</p>}
          {session && batteries && (
            <>
              {role === 'manufacturer' && (
                <Manufacturer
                  batteries={batteries}
                  companies={companies}
                  session={session}
                  selected={battery}
                />
              )}
              {scanning && !passportId && (
                <Scan role={role} batteries={batteries} scans={scans} />
              )}
              {scanning && passportId && !battery && <NotFound role={role} />}
              {role === 'garage' && battery && <Garage battery={battery} />}
              {role === 'customer' && battery && <Customer battery={battery} />}
              {role === 'sorting' && battery && <Sorting battery={battery} />}
            </>
          )}
        </main>
      )}
    </>
  )
}

function DemoMode({ onPick }) {
  const [error, setError] = useState('')

  async function pick(event, role) {
    event.preventDefault()
    setError('')
    try {
      await demoLogIn(role)
      window.location.hash = `#/${role}`
      onPick()
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <div className="auth">
      <h1>Demo mode</h1>
      <p className="muted">For testing: choose a role to enter with its first test account.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {Object.entries(ROLES).map(([key, option]) => (
        <a className="card label" href={`#/${key}`} key={key} onClick={(event) => pick(event, key)}>
          <strong>{option.label}</strong>
          <span className="muted">{option.text}</span>
        </a>
      ))}
    </div>
  )
}

function Auth() {
  const { companies } = useBatteries()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isSignUp) await signUp({ email, password, role, company })
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
        {isSignUp && role === 'manufacturer' && (
          <>
            <label htmlFor="company">Company</label>
            <select
              id="company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              required
            >
              <option value="">Choose your company</option>
              {companies.map(({ name }) => <option key={name}>{name}</option>)}
            </select>
            {companies.length === 0 && (
              <p className="error" role="alert">Companies could not be loaded from the database.</p>
            )}
          </>
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
    </div>
  )
}

const WARRANTY_YEARS = 8

function defaultDates() {
  const month = new Date().toISOString().slice(0, 7)
  const warranty = `${Number(month.slice(0, 4)) + WARRANTY_YEARS}${month.slice(4)}`
  return { manufacturingDate: month, serviceDate: month, warranty }
}

const BATTERY_FIELDS = [
  ['batteryId', 'Battery ID', 'text'],
  ['passportId', 'Passport ID', 'text'],
  ['manufacturingDate', 'Manufacturing date', 'month'],
  ['serviceDate', 'Put into service', 'month'],
  ['warranty', 'Warranty until', 'month'],
]

function BatteryQr({ battery }) {
  const passportId = battery.batteryPassportId
  const url = useMemo(() => qrDataUrl(passportId), [passportId])
  return (
    <section className="card qr">
      <img src={url} alt={`QR code for passport ${passportId}`} />
      <strong>{passportId}</strong>
      <span className="muted">{battery.batteryId} · {battery.model.name}</span>
    </section>
  )
}

function Manufacturer({ batteries, companies, session, selected }) {
  const { saving } = useBatteries()
  // Demo mode has no company, so it uses the first one.
  const company = companies.find(({ name }) => name === session.company) ?? companies[0]
  const models = company?.models ?? []
  const operators = company?.operators ?? []
  const companyBatteries = batteries.filter((b) => operators.includes(b.operator.name))
  const requests = companyBatteries.filter((b) => b.request)
  const shown = companyBatteries.includes(selected) ? selected : undefined
  // Only what the user changed is kept, so the suggested IDs follow the database until then.
  const [edits, setEdits] = useState({})
  const fields = {
    modelId: models[0] ?? '',
    operatorName: operators[0] ?? '',
    ...nextBatteryIds(batteries),
    ...defaultDates(),
    ...edits,
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState('')

  const edit = (name) => (event) => setEdits({ ...edits, [name]: event.target.value })

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setCreated('')
    try {
      const { passportId } = await createBattery(fields)
      setCreated(passportId)
      setEdits({})
      window.location.hash = `#/manufacturer/${passportId}`
    } catch (failure) {
      setError(failure.message)
    }
    setBusy(false)
  }

  return (
    <>
      <h1>Passport management</h1>
      {company
        ? <p className="muted">{company.name}</p>
        : <p className="error" role="alert">No company found in the database.</p>}
      <section className="card" aria-labelledby="notifications">
        <h2 id="notifications">Notifications ({requests.length})</h2>
        {requests.length === 0 && <p className="muted">No pending requests.</p>}
        {requests.map((b) => (
          <div className="request" key={b.batteryId}>
            <div>
              <strong>Garage requests Original → Waste for {b.batteryPassportId}</strong>
              <p>{b.request.reason}</p>
              <p className="muted">{formatDateTime(b.request.at)}</p>
            </div>
            <button
              className="button-danger"
              disabled={saving}
              onClick={() => approveWaste(b.batteryId, b.request.id)}
            >
              Change status to Waste
            </button>
          </div>
        ))}
      </section>
      <details className="card">
        <summary>Create new battery</summary>
        <form className="form create-form" onSubmit={submit}>
          <label htmlFor="modelId">Model</label>
          <select id="modelId" value={fields.modelId} onChange={edit('modelId')} required>
            {models.map((model) => <option key={model}>{model}</option>)}
          </select>
          <label htmlFor="operatorName">Economic operator</label>
          <select id="operatorName" value={fields.operatorName} onChange={edit('operatorName')} required>
            {operators.map((operator) => <option key={operator}>{operator}</option>)}
          </select>
          {BATTERY_FIELDS.map(([name, label, type]) => (
            <div className="form" key={name}>
              <label htmlFor={name}>{label}</label>
              <input id={name} type={type} value={fields[name]} onChange={edit(name)} required />
            </div>
          ))}
          <p className="muted">This saves the battery to the database shared by the whole team.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button disabled={busy || !company}>Create battery</button>
        </form>
      </details>
      <section className="card">
        <h2>Your company's batteries ({companyBatteries.length})</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Passport</th>
                <th>Battery</th>
                <th>Model</th>
                <th>SOH</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {companyBatteries.map((b) => (
                <tr key={b.batteryId} className={b === shown ? 'row-selected' : undefined}>
                  <td><a href={`#/manufacturer/${b.batteryPassportId}`}>{b.batteryPassportId}</a></td>
                  <td>{b.batteryId}</td>
                  <td>{b.model.name}</td>
                  <td>{b.performance.soh}%</td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {shown && (
        <>
          <h2 className="section-title">{shown.batteryPassportId}</h2>
          {created === shown.batteryPassportId && (
            <Banner tone="success" title="Battery created">
              {created} is now in the database. Its QR code is below.
            </Banner>
          )}
          <div className="details-grid">
            <BatteryQr battery={shown} />
            <Identification battery={shown} />
            <KeyParameters battery={shown} />
            <Composition battery={shown} />
          </div>
          <Modules battery={shown} />
          <History battery={shown} />
        </>
      )}
    </>
  )
}

function QrScanner({ onCode }) {
  const video = useRef(null)
  const latestOnCode = useRef(onCode)
  const [cameraOn, setCameraOn] = useState(false)
  const [error, setError] = useState('')

  // The camera loop outlives renders, so it always calls the newest callback.
  useEffect(() => {
    latestOnCode.current = onCode
  })

  useEffect(() => {
    if (!cameraOn) return undefined
    let stream
    let timer
    let stopped = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) return stream.getTracks().forEach((track) => track.stop())
        video.current.srcObject = stream
        await video.current.play()
        if (stopped) return undefined
        timer = setInterval(() => {
          const { videoWidth, videoHeight } = video.current
          const found = videoWidth && readQr(video.current, videoWidth, videoHeight)
          if (found) latestOnCode.current(found)
        }, CAMERA_SCAN_MS)
      } catch {
        if (stopped) return undefined
        setError('Camera not available. Allow camera access, or use a photo of the QR code.')
        setCameraOn(false)
      }
      return undefined
    }

    start()
    return () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [cameraOn])

  async function readFile(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const image = await createImageBitmap(file)
      const found = readQr(image, image.width, image.height)
      if (found) onCode(found)
      else setError('No QR code found in this image.')
    } catch {
      setError('This file could not be read as an image.')
    }
  }

  return (
    <section className="card form">
      <h2>Scan the QR code</h2>
      <button
        type="button"
        className="button-ghost"
        onClick={() => {
          setError('')
          setCameraOn(!cameraOn)
        }}
      >
        {cameraOn ? 'Stop camera' : 'Scan with camera'}
      </button>
      {cameraOn && (
        <video className="qr-video" ref={video} aria-label="Camera preview" muted playsInline />
      )}
      <label htmlFor="qr-image">Or use a photo of the QR code</label>
      <input id="qr-image" type="file" accept="image/*" capture="environment" onChange={readFile} />
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

function Scan({ role, batteries, scans }) {
  const [code, setCode] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [scanError, setScanError] = useState('')
  // The camera keeps reading the same code while the scan is being saved.
  const opening = useRef(false)
  const listed = scans.flatMap((id) => batteries.filter((b) => b.batteryPassportId === id))

  async function openBattery(value) {
    const battery = findBattery(batteries, value)
    if (!battery) return setNotFound(true)
    if (opening.current) return undefined
    opening.current = true
    setScanError('')
    try {
      await addScan(battery.batteryPassportId)
      window.location.hash = `#/${role}/${battery.batteryPassportId}`
    } catch (failure) {
      setScanError(failure.message)
    }
    opening.current = false
    return undefined
  }

  function submit(event) {
    event.preventDefault()
    openBattery(code)
  }

  function handleQrCode(value) {
    setCode(value)
    openBattery(value)
  }

  return (
    <>
      <h1>Scan battery QR code</h1>
      <QrScanner onCode={handleQrCode} />
      <form className="card form" onSubmit={submit}>
        <label htmlFor="code">Passport ID</label>
        <div className="form-row">
          <input
            id="code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setNotFound(false)
            }}
            placeholder="BP-2027-0001"
            required
          />
          <button>Open passport</button>
        </div>
        {notFound && <p className="error" role="alert">No battery found with this passport ID. It looks like BP-2027-0001.</p>}
        {scanError && <p className="error" role="alert">{scanError}</p>}
      </form>
      <h2 className="section-title">Your batteries ({listed.length})</h2>
      {listed.length === 0 && <p className="muted">No batteries scanned yet.</p>}
      <div className="label-grid">
        {listed.map((b) => (
          <a className="card label" href={`#/${role}/${b.batteryPassportId}`} key={b.batteryId}>
            <strong>{b.batteryPassportId}</strong>
            <span className="muted">{b.model.name}</span>
            <span><StatusBadge status={b.status} /></span>
          </a>
        ))}
      </div>
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
  const { saving } = useBatteries()
  const [reason, setReason] = useState('')

  function submit(event) {
    event.preventDefault()
    reportOutOfService(battery.batteryId, reason.trim())
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
        <Banner tone="info" title="Request sent to the manufacturer">
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
            maxLength={500}
            required
          />
          <button className="button-danger" disabled={saving || !reason.trim()}>
            Notify manufacturer
          </button>
        </form>
      )}
      <div className="details-grid">
        <Identification battery={battery} />
        <KeyParameters battery={battery} />
      </div>
      <Modules battery={battery} />
      <History battery={battery} />
    </>
  )
}

function Customer({ battery }) {
  return (
    <>
      <BatteryTitle battery={battery} backTo="#/customer" />
      {battery.status === 'Waste' && (
        <Banner tone="danger" title="Out of service">
          This battery has been taken out of service and is going to the sorting centre.
        </Banner>
      )}
      {battery.request && (
        <Banner tone="info" title="Under review">
          A garage has reported a defect, and the manufacturer is reviewing it.
        </Banner>
      )}
      <div className="details-grid">
        <Identification battery={battery} />
        <KeyParameters battery={battery} />
      </div>
      <History battery={battery} />
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
          Status is {battery.status}, expected Waste. Contact the manufacturer.
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
        <h1>{battery.batteryPassportId}</h1>
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
        ['Battery ID', battery.batteryId],
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
        ['Diagnosis', battery.diagnosis],
        ['State of health', `${performance.soh}%`],
        ['State of charge', `${performance.soc}%`],
        ['Temperature', `${performance.temperatureC} °C`],
        ['Internal resistance increase', `${performance.resistanceIncreasePct}%`],
        ['Full cycles', durability.fullCycles],
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

function Modules({ battery }) {
  const { saving } = useBatteries()
  const pending = battery.pendingTelemetry
  const [simulating, setSimulating] = useState(false)
  const [simulateError, setSimulateError] = useState('')

  async function handleSimulate() {
    setSimulating(true)
    setSimulateError('')
    try {
      await sendTelemetry(
        {
          I_A: 84.3,
          modules: [
            { id: 1, dV_V: 0.694, R_mOhm: 8.23 },
            { id: 2, dV_V: 0.513, R_mOhm: 6.08 },
            { id: 3, dV_V: 0.388, R_mOhm: 4.6 },
            { id: 4, dV_V: 0.318, R_mOhm: 3.78 },
            { id: 5, dV_V: 0.524, R_mOhm: 6.22 },
          ],
        },
        battery.batteryPassportId,
      )
    } catch (failure) {
      setSimulateError(failure.message)
    } finally {
      setSimulating(false)
    }
  }

  return (
    <section className="card">
      <div className="title-row">
        <h2>Modules</h2>
        {/* Team testing tool: only in `npm run dev`, left out of production builds. */}
        {import.meta.env.DEV && (
          <button
            type="button"
            className="button-ghost button-small"
            disabled={simulating || saving}
            onClick={handleSimulate}
            title="Simulate the telemetry JSON sent through ngrok"
          >
            {simulating ? 'Sending…' : '⚡ Simulate telemetry'}
          </button>
        )}
      </div>
      {simulateError && <p className="error" role="alert">{simulateError}</p>}

      {pending && (
        <div className="telemetry-banner banner banner-info">
          <div>
            <strong>New telemetry received (current: {pending.I_A} A)</strong>
            <p className="muted">
              Received {formatDateTime(pending.receivedAt)}. Compare the new values with the database below.
            </p>
          </div>
          <button
            type="button"
            className="button-update-neo4j"
            disabled={saving}
            onClick={() => applyTelemetry(battery.batteryId)}
          >
            {saving ? 'Updating…' : 'Update values'}
          </button>
        </div>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Initial (mΩ)</th>
              <th>{pending ? 'Database value (mΩ)' : 'Current (mΩ)'}</th>
              {pending && <th className="th-new">New value (mΩ)</th>}
              {pending && <th className="th-new">New ΔV (V)</th>}
              <th>Increase</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {battery.modules.map((m, index) => {
              const newMod = pending?.modules?.find(
                (p) => p.id === (m.index ?? index + 1) || p.name === m.name || `Module ${p.id}` === m.name,
              )
              const newIncrease =
                newMod && m.initialMohm
                  ? Math.round(((newMod.R_mOhm - m.initialMohm) / m.initialMohm) * 1000) / 10
                  : null

              return (
                <tr key={m.name}>
                  <td><strong>{m.name}</strong></td>
                  <td>{m.initialMohm}</td>
                  <td>
                    {newMod ? (
                      <span className="value-old">{m.nowMohm ?? 'No reading'}</span>
                    ) : (
                      m.nowMohm ?? 'No reading'
                    )}
                  </td>
                  {pending && (
                    <td>
                      {newMod ? (
                        <span className="value-new">{newMod.R_mOhm} mΩ</span>
                      ) : (
                        '–'
                      )}
                    </td>
                  )}
                  {pending && (
                    <td>
                      {newMod ? <span className="value-dv">{newMod.dV_V} V</span> : '–'}
                    </td>
                  )}
                  <td>
                    {newMod && newIncrease != null ? (
                      <span>
                        <span className="muted">{m.increasePct == null ? '–' : `${m.increasePct}%`}</span>
                        <span className="arrow-diff"> → </span>
                        <strong className="value-new-pct">{newIncrease}%</strong>
                      </span>
                    ) : m.increasePct == null ? (
                      '–'
                    ) : (
                      `${m.increasePct}%`
                    )}
                  </td>
                  <td>
                    {newMod ? (
                      <span className="level-diff">
                        {m.level ? <StatusBadge status={m.level} /> : <span className="muted">–</span>}
                        <span className="arrow-diff"> → </span>
                        <StatusBadge status={newMod.level} />
                      </span>
                    ) : m.level ? (
                      <StatusBadge status={m.level} />
                    ) : (
                      '–'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2 className="subsection-title">Alerts ({battery.alerts.length})</h2>
      {battery.alerts.length === 0 && <p className="muted">No alerts.</p>}
      <ol className="history">
        {battery.alerts.map((alert, index) => (
          <li key={index}>
            <span><StatusBadge status={alert.level} /> {alert.module}: {alert.message}</span>
            <span className="muted">{formatDateTime(alert.createdAt)}</span>
          </li>
        ))}
      </ol>
    </section>
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
