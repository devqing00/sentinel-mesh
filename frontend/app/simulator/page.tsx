'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const DEVICE_ID = 'WATCH_001';
const PROXIMITIES = ['very close', 'close', 'moderate'] as const;
type Proximity = typeof PROXIMITIES[number];

const PROX_DOT: Record<Proximity, string> = {
  'very close': 'bg-red-400',
  'close':      'bg-orange-400',
  'moderate':   'bg-yellow-400',
};
const PROX_TEXT: Record<Proximity, string> = {
  'very close': 'text-red-400',
  'close':      'text-orange-400',
  'moderate':   'text-yellow-400',
};

interface NearbyContact {
  user_id:   string;
  proximity: Proximity;
  rssi:      number;
}

const RING_R    = 85;
const RING_CIRC = 2 * Math.PI * RING_R;
const SPARK_W   = 260;
const SPARK_H   = 52;

export default function SimulatorPage() {
  const [isRunning,  setIsRunning]  = useState(true);
  const [isSpiking,  setIsSpiking]  = useState(false);
  const [beating,    setBeating]    = useState(false);

  // Vitals
  const [hr,      setHr]      = useState(72);
  const [temp,    setTemp]    = useState(36.8);
  const [spo2,    setSpo2]    = useState(98);
  const [steps,   setSteps]   = useState(1247);
  const [battery, setBattery] = useState(87);

  // HR history for sparkline (last 30 ticks)
  const [hrHistory, setHrHistory] = useState<number[]>(Array(30).fill(72));

  // Bluetooth contacts
  const [contacts,    setContacts]    = useState<NearbyContact[]>([]);
  const [allUserIds,  setAllUserIds]  = useState<string[]>([]);

  // Ping state
  const [pingLog,    setPingLog]    = useState<string[]>([]);
  const [pingStatus, setPingStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [totalPings, setTotalPings] = useState(0);

  // Backend analysis result from last ping response
  const [backendAnalysis, setBackendAnalysis] = useState<{
    risk_tier: string;
    is_anomaly: boolean;
    dual_anomaly: boolean;
    alert_severity: string;
    cluster: string;
    nearby_contacts_registered: number;
  } | null>(null);

  // Spike countdown
  const [spikeLeft, setSpikeLeft] = useState(0);

  // Clock
  const [clockTime, setClockTime] = useState('');

  // Refs so intervals always read the latest value
  const isSpikingRef  = useRef(false);
  const hrRef         = useRef(72);
  const tempRef       = useRef(36.8);
  const spo2Ref       = useRef(98);
  const stepsRef      = useRef(1247);
  const contactsRef   = useRef<NearbyContact[]>([]);

  useEffect(() => { isSpikingRef.current = isSpiking; }, [isSpiking]);
  useEffect(() => { hrRef.current = hr; },               [hr]);
  useEffect(() => { tempRef.current = temp; },           [temp]);
  useEffect(() => { spo2Ref.current = spo2; },           [spo2]);
  useEffect(() => { stepsRef.current = steps; },         [steps]);
  useEffect(() => { contactsRef.current = contacts; },   [contacts]);

  // ── Clock ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () =>
      setClockTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Fetch real user IDs for bluetooth contacts ────────────────────────────
  useEffect(() => {
    // We statically load the real baseline users (U001 to U050)
    // to avoid bloating the db with fake UIDs or causing errors
    const realUsers = Array.from({ length: 50 }, (_, i) => `U${String(i + 1).padStart(3, '0')}`);
    setAllUserIds(realUsers);
  }, []);

  // ── Vitals simulation tick (1 s) ─────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      const spiking = isSpikingRef.current;

      setHr(prev => {
        const target = spiking ? 132 : 72;
        const noise  = (Math.random() - 0.5) * (spiking ? 10 : 5);
        const next   = Math.round(Math.max(45, Math.min(185, prev + (target - prev) * 0.18 + noise)));
        hrRef.current = next;
        return next;
      });
      setTemp(prev => {
        const target = spiking ? 39.3 : 36.8;
        const noise  = (Math.random() - 0.5) * 0.09;
        const next   = Math.round(Math.max(35, Math.min(42, prev + (target - prev) * 0.08 + noise)) * 10) / 10;
        tempRef.current = next;
        return next;
      });
      setSpo2(prev => {
        const target = spiking ? 91 : 98;
        const noise  = (Math.random() - 0.5) * 0.6;
        const next   = Math.round(Math.max(85, Math.min(100, prev + (target - prev) * 0.1 + noise)));
        spo2Ref.current = next;
        return next;
      });
      setSteps(prev => {
        const next = prev + Math.floor(Math.random() * 3);
        stepsRef.current = next;
        return next;
      });
      setBattery(prev => Math.max(5, +(prev - 0.008).toFixed(3)));
      setHrHistory(prev => [...prev.slice(-29), hrRef.current]);
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // ── Heartbeat animation (rAF loop synced to HR) ───────────────────────────
  useEffect(() => {
    if (!isRunning) { setBeating(false); return; }
    let raf: number;
    let lastBeat = performance.now();
    const tick = (now: number) => {
      const beatMs = (60 / Math.max(30, hrRef.current)) * 1000;
      if (now - lastBeat >= beatMs) {
        lastBeat = now;
        setBeating(true);
        setTimeout(() => setBeating(false), 180);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isRunning]);

  // ── Spike countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSpiking) { setSpikeLeft(0); return; }
    setSpikeLeft(45);
    const id = setInterval(() => {
      setSpikeLeft(prev => {
        if (prev <= 1) { clearInterval(id); setIsSpiking(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isSpiking]);

  // ── Randomize bluetooth contacts (every 15-30 s) ──────────────────────────
  const randomizeContacts = useCallback(() => {
    if (allUserIds.length === 0) return;
    const count     = Math.floor(Math.random() * 4) + 1;
    const shuffled  = [...allUserIds].sort(() => Math.random() - 0.5).slice(0, count);
    const next: NearbyContact[] = shuffled.map(uid => ({
      user_id:   uid,
      proximity: PROXIMITIES[Math.floor(Math.random() * PROXIMITIES.length)],
      rssi:      Math.round(-90 + Math.random() * 55),
    }));
    setContacts(next);
    contactsRef.current = next;
  }, [allUserIds]);

  useEffect(() => {
    if (!isRunning || allUserIds.length === 0) return;
    randomizeContacts();
    const interval = 13000 + Math.random() * 17000;
    const id = setInterval(randomizeContacts, interval);
    return () => clearInterval(id);
  }, [isRunning, allUserIds, randomizeContacts]);

  // ── Ping backend every 3 s ────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(async () => {
      setPingStatus('sending');
      try {
        const res = await fetch(`${API}/api/devices/ping`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id:         DEVICE_ID,
            heart_rate:      hrRef.current,
            temperature:     tempRef.current,
            spo2:            spo2Ref.current,
            steps:           stepsRef.current,
            nearby_contacts: contactsRef.current.map(c => c.user_id),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setPingStatus('ok');
          setTotalPings(p => p + 1);
          if (data.analysis) {
            setBackendAnalysis(data.analysis);
            setPingLog(prev => [
              `${new Date().toLocaleTimeString()}  ${data.analysis.risk_tier}${data.analysis.is_anomaly ? ' ⚠' : ''}  HR:${hrRef.current}bpm  T:${tempRef.current}°C  [${data.analysis.nearby_contacts_registered} contacts]`,
              ...prev,
            ].slice(0, 6));
          }
        } else {
          setPingStatus('error');
        }
      } catch {
        setPingStatus('error');
      }
      setTimeout(() => setPingStatus(s => s !== 'idle' ? 'idle' : s), 2200);
    }, 3000);
    return () => clearInterval(id);
  }, [isRunning]);

  // ── Derived display values ────────────────────────────────────────────────
  const hrZone     = hr > 110 ? 'danger' : hr > 88 ? 'elevated' : 'normal';
  const ringColor  = hrZone === 'danger' ? '#ef4444' : hrZone === 'elevated' ? '#f59e0b' : '#22c55e';
  const hrClass    = hrZone === 'danger' ? 'text-red-400'  : hrZone === 'elevated' ? 'text-amber-400' : 'text-green-400';
  const tempClass  = temp > 38.5  ? 'text-red-400'  : temp > 37.5  ? 'text-orange-400' : 'text-cyan-400';
  const spo2Class  = spo2 < 94    ? 'text-red-400'  : spo2 < 97   ? 'text-amber-400'  : 'text-blue-400';

  // SVG ring progress (40–185 bpm range)
  const hrPct     = Math.min(1, Math.max(0, (hr - 40) / 145));
  const ringOffset = RING_CIRC * (1 - hrPct);

  // Sparkline coordinates
  const sparkMin = 50;
  const sparkMax = 180;
  const sparkPts = hrHistory.map((val, i) => {
    const x = (i / 29) * SPARK_W;
    const y = SPARK_H - Math.max(0, Math.min(1, (val - sparkMin) / (sparkMax - sparkMin))) * SPARK_H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="min-h-screen bg-[#050505] font-sans text-gray-200 flex flex-col">
      {/* ── Top Nav ──────────────────────────────────────────────────────────── */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-2 p-1.5 -ml-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
            </div>
            <span className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Device Simulator</span>
          </div>
        </div>

      </header>

      {/* ── Main Layout ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-wrap items-start justify-center gap-12 p-8 overflow-y-auto relative">
        
        {/* Device Shell (Premium Smartphone Mockup) */}
        <div className="relative w-[380px] h-[780px] bg-[#111] rounded-[3.5rem] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_20px_40px_-10px_rgba(0,0,0,0.5),0_0_100px_rgba(0,0,0,0.3)] border-[6px] border-[#222] p-1.5 flex-shrink-0 z-10">
          
          {/* Side Buttons */}
          <div className="absolute top-[120px] -left-[10px] w-1 h-12 bg-[#333] rounded-l-md shadow-inner" />
          <div className="absolute top-[180px] -left-[10px] w-1 h-12 bg-[#333] rounded-l-md shadow-inner" />
          <div className="absolute top-[150px] -right-[10px] w-1 h-16 bg-[#333] rounded-r-md shadow-inner" />
          
          {/* Inner Screen */}
          <div className="w-full h-full bg-[#fafafa] rounded-[3rem] overflow-hidden flex flex-col relative border border-black/10 shadow-inner">
            
            {/* Dynamic Island */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[120px] h-[27px] bg-black rounded-full z-40 flex items-center justify-between px-3 shadow-[inset_0_-2px_4px_rgba(255,255,255,0.1)]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0a0a0a] ring-1 ring-white/10" />
              {isRunning && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.6)]" />
              )}
            </div>

            {/* Status Bar */}
            <div className="h-12 pt-2 flex items-start justify-between px-6 text-[11px] font-bold text-gray-900 rounded-t-[3rem] bg-white/50 backdrop-blur-md z-30">
              <span className="mt-1">{clockTime || '12:00'}</span>
              <div className="flex items-center gap-1.5 mt-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 22h20V2L2 22zm18-2H6.83L20 6.83V20z"/></svg>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z"/></svg>
                <div className="flex items-center">
                  <div className="w-6 h-3 border border-gray-600 rounded-sm relative overflow-hidden">
                    <div className={`absolute inset-[1.5px] rounded-[1px] transition-all duration-500 ${battery > 20 ? 'bg-gray-800' : 'bg-red-500'}`} style={{ width: `${Math.max(3, battery - 4)}%` }} />
                  </div>
                  <div className="w-[2px] h-2 bg-gray-600 ml-[1px] rounded-r-sm" />
                </div>
              </div>
            </div>

            {/* App Content */}
            <div className="flex-1 overflow-y-auto scrollbar-none pb-8 flex flex-col pt-2 bg-[#f4f5f7]">
              
              {/* App Header */}
              <div className="px-5 pt-2 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-gray-900 font-extrabold text-2xl tracking-tight">Sentinel Health</h1>
                  <p className="text-gray-500 text-xs font-semibold tracking-wide uppercase mt-0.5">{DEVICE_ID}</p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isSpiking ? 'bg-red-50' : isRunning ? 'bg-green-50' : 'bg-white border border-gray-200'}`}>
                  <svg className={`w-5 h-5 transition-colors ${isSpiking ? 'text-red-500' : isRunning ? 'text-green-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </div>
              </div>

              {/* Heart Rate Ring Display */}
              <div className="flex justify-center py-4">
                <div className="relative bg-white rounded-full p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" style={{ width: 220, height: 220 }}>
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r={RING_R} className="stroke-gray-100" strokeWidth="12" fill="none" />
                    <circle cx="100" cy="100" r={RING_R} className="transition-all duration-1000 ease-out" strokeWidth="12" fill="none" stroke={ringColor} strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className={`transition-transform duration-100 ${beating ? 'scale-110' : 'scale-100'}`}>
                      <svg className={`w-8 h-8 mb-1 ${hrClass}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-5xl font-black tabular-nums tracking-tighter ${hrClass}`}>{hr}</span>
                      <span className="text-gray-400 font-bold text-sm">BPM</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-1">Heart Rate</span>
                  </div>
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="px-5 grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Temp</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-black tabular-nums ${tempClass}`}>{temp.toFixed(1)}</span>
                    <span className="text-gray-400 text-xs font-bold">°C</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SpO2</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-black tabular-nums ${spo2Class}`}>{spo2}</span>
                    <span className="text-gray-400 text-xs font-bold">%</span>
                  </div>
                </div>
              </div>

              {/* Bluetooth Contacts Panel */}
              <div className="px-5 mb-6">
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100/50 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isRunning ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <svg className={`w-4 h-4 ${isRunning ? 'text-blue-500' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">Nearby Devices</h3>
                        <p className="text-[10px] text-gray-400 font-semibold">{isRunning ? 'Active Scanning' : 'Bluetooth Off'}</p>
                      </div>
                    </div>
                    {isRunning && (
                      <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-[10px] font-bold">
                        {contacts.length} found
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 relative z-10">
                    {isRunning && contacts.length > 0 ? contacts.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50/80 rounded-2xl p-3 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shadow-sm animate-pulse ${PROX_DOT[c.proximity]}`} />
                          <div>
                            <div className="text-xs font-bold text-gray-800">{c.user_id}</div>
                            <div className={`text-[9px] font-semibold uppercase tracking-wider ${PROX_TEXT[c.proximity]}`}>{c.proximity}</div>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono font-semibold text-gray-400 bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-sm">
                          {c.rssi} dBm
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-xs font-semibold text-gray-400">
                          {isRunning ? 'Searching for mesh nodes...' : 'Start simulation to scan'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>



            </div>
          </div>
        </div>

        {/* ── Developer Analytics Panel (Desktop side) ── */}
        <div className="w-[450px] flex flex-col gap-6 relative z-10">
          
          <div className="bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-semibold mb-1 text-white">Live Telemetry</h2>
            <p className="text-sm text-gray-400 mb-6">Real-time data pushing to Sentinel Backend</p>
            
            {/* Ping Indicator */}
            <div className="flex items-center justify-between mb-6 bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="relative w-3 h-3">
                  {pingStatus === 'sending' && <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping" />}
                  <div className={`relative w-3 h-3 rounded-full ${pingStatus === 'ok' ? 'bg-green-500' : pingStatus === 'error' ? 'bg-red-500' : pingStatus === 'sending' ? 'bg-blue-500' : 'bg-gray-600'}`} />
                </div>
                <span className="font-mono text-sm font-medium text-gray-300">
                  {pingStatus.toUpperCase()}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 font-medium">Total Pings</div>
                <div className="font-mono text-white text-lg">{totalPings}</div>
              </div>
            </div>

            {/* Backend Response Analysis */}
            {backendAnalysis && (
              <div className="mb-6">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">AI Risk Assessment</div>
                <div className={`p-4 rounded-2xl border ${backendAnalysis.is_anomaly ? 'bg-rose-500/10 border-rose-500/20' : 'bg-green-500/5 border-green-500/10'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-bold ${backendAnalysis.is_anomaly ? 'text-rose-400' : 'text-green-400'}`}>
                          {backendAnalysis.risk_tier}
                        </span>
                        {backendAnalysis.is_anomaly && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/20">
                            ANOMALY DETECTED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        Cluster: <span className="text-white font-mono">{backendAnalysis.cluster}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Contacts Registered: <span className="text-white font-mono">{backendAnalysis.nearby_contacts_registered}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Terminal Log */}
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Transmission Log</div>
              <div className="bg-[#0a0a0a] rounded-2xl p-4 font-mono text-[11px] h-48 overflow-y-auto border border-white/5 ring-1 ring-inset ring-white/5">
                {pingLog.length === 0 ? (
                  <div className="text-gray-600 h-full flex items-center justify-center">Awaiting transmission...</div>
                ) : (
                  <div className="space-y-2">
                    {pingLog.map((log, i) => (
                      <div key={i} className={`${i === 0 ? 'text-white' : 'text-gray-500'}`}>
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
