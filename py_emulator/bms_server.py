"""
BMS control panel: a small local web server around bms_emulator.py.

  pip install neo4j flask
  python bms_server.py            # live: writes readings to the Neo4j database from .env
  python bms_server.py --dry-run  # no database, values only shown on the page

Then open http://127.0.0.1:5050 in the browser.

The page lets you start/stop a scenario, choose the battery, and hold a module at a chosen
resistance. The server uses the same functions and queries as bms_emulator.py, so the readings,
levels and alerts are created by the database exactly like with the command line script.
"""
import argparse
import os
import re
import threading
import time
from pathlib import Path

from flask import Flask, jsonify, request, send_file

import bms_emulator as bms

HERE = Path(__file__).parent
app = Flask(__name__)
lock = threading.Lock()
driver = None
DRY = False

S = {
    "running": False,
    "scenario": "normal",
    "battery": "BAT-0001",
    "interval": 2.0,
    "tick": 0,
    "overrides": {},          # module index -> resistance in mOhm held by the user
    "modules": [],
    "diagnosis": None,
    "lastUpdate": None,
    "error": None,
}


def do_tick():
    with lock:
        scenario, tick, bid = S["scenario"], S["tick"], S["battery"]
        overrides = dict(S["overrides"])
    base = bms.resistances(scenario, tick)
    modules = []
    for idx, r in enumerate(base, start=1):
        if idx in overrides:
            r = overrides[idx]
        di, dv = bms.measure(r)
        r_calc = round(dv / di * 1000.0, 2)
        if DRY:
            level = bms.level_of(r_calc)
        else:
            with driver.session(database=bms.DB) as s:
                rec = s.run(bms.WRITE_READING, bid=bid, idx=idx, r=r_calc, di=di, dv=dv).single()
            if rec is None:
                raise RuntimeError("Battery %s or its module %d was not found in the database" % (bid, idx))
            level = rec["level"]
        modules.append({"module": idx, "resistanceMohm": r_calc, "level": level, "held": idx in overrides})
    levels = [m["level"] for m in modules]
    if DRY:
        diagnosis = "CRITICAL" if "CRITICAL" in levels else "WARNING" if "WARNING" in levels else "OK"
    else:
        with driver.session(database=bms.DB) as s:
            diagnosis = s.run(bms.UPDATE_DIAGNOSIS, bid=bid).single()["diagnosis"]
    with lock:
        S["modules"] = modules
        S["diagnosis"] = diagnosis
        S["tick"] = tick + 1
        S["lastUpdate"] = time.strftime("%H:%M:%S")
        S["error"] = None


def loop():
    while True:
        with lock:
            running, interval = S["running"], S["interval"]
        if running:
            try:
                do_tick()
            except Exception as e:  # show the problem on the page and stop
                with lock:
                    S["error"] = str(e)
                    S["running"] = False
            time.sleep(interval)
        else:
            time.sleep(0.3)


@app.get("/")
def index():
    return send_file(HERE / "control_panel.html")


@app.get("/api/state")
def get_state():
    with lock:
        out = dict(S)
        out["overrides"] = {str(k): v for k, v in S["overrides"].items()}
    out["dryRun"] = DRY
    out["maxMohm"] = bms.MAX_R
    out["warnMohm"] = round(bms.MAX_R * bms.WARN_RATIO, 2)
    return jsonify(out)


@app.post("/api/start")
def start():
    body = request.get_json(silent=True) or {}
    scenario = body.get("scenario", "normal")
    battery = str(body.get("battery", "BAT-0001"))
    try:
        interval = float(body.get("interval", 2.0))
    except (TypeError, ValueError):
        return jsonify(error="interval must be a number"), 400
    if scenario not in ("normal", "degrade", "critical"):
        return jsonify(error="scenario must be normal, degrade or critical"), 400
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", battery):
        return jsonify(error="battery id has invalid characters"), 400
    if not 0.5 <= interval <= 30:
        return jsonify(error="interval must be between 0.5 and 30 seconds"), 400
    with lock:
        S.update(running=True, scenario=scenario, battery=battery, interval=interval, tick=0, error=None)
    return jsonify(ok=True)


@app.post("/api/stop")
def stop():
    with lock:
        S["running"] = False
    return jsonify(ok=True)


@app.post("/api/override")
def override():
    body = request.get_json(silent=True) or {}
    try:
        module = int(body.get("module"))
    except (TypeError, ValueError):
        return jsonify(error="module must be 1 to 5"), 400
    if not 1 <= module <= 5:
        return jsonify(error="module must be 1 to 5"), 400
    value = body.get("value")
    with lock:
        if value is None:
            S["overrides"].pop(module, None)
        else:
            try:
                value = float(value)
            except (TypeError, ValueError):
                return jsonify(error="value must be a number"), 400
            if not 0.5 <= value <= 30:
                return jsonify(error="value must be between 0.5 and 30 mOhm"), 400
            S["overrides"][module] = value
    return jsonify(ok=True)


def main():
    global driver, DRY
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true", help="do not use the database")
    p.add_argument("--port", type=int, default=5050)
    a = p.parse_args()
    DRY = a.dry_run
    bms.load_env()
    bms.DB = os.environ.get("NEO4J_DATABASE") or None
    if not DRY:
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(
            os.environ["NEO4J_URI"],
            auth=(os.environ.get("NEO4J_USER") or os.environ.get("NEO4J_USERNAME") or "neo4j",
                  os.environ["NEO4J_PASSWORD"]),
        )
        driver.verify_connectivity()
        print("Connected to Neo4j.")
    threading.Thread(target=loop, daemon=True).start()
    print("Control panel: http://127.0.0.1:%d  (%s)" % (a.port, "dry run, no database" if DRY else "live"))
    app.run(host="127.0.0.1", port=a.port, threaded=True)


if __name__ == "__main__":
    main()
