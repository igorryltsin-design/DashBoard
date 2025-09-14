import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';

interface Metrics { cpuPct: number; mem: { total: number; free: number }; disk?: { total: number; free: number } | null; disks?: { mount:string; label:string; total:number; free:number }[]; net?: { rxBps:number; txBps:number } }

const Bar = ({ pct, color }:{ pct:number; color:string }) => (
  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded">
    <div className="h-2 rounded" style={{ width: `${Math.min(100, Math.max(0,pct)).toFixed(0)}%`, backgroundColor: color }} />
  </div>
);

const fmtBytes = (n?: number) => {
  if (!n && n!==0) return '-';
  const u = ['B','KB','MB','GB','TB']; let i=0; let v=n; while (v>=1024 && i<u.length-1){v/=1024;i++;}
  return `${v.toFixed(v<10?1:0)} ${u[i]}`;
};

const Sparkline = ({ values, color="#60a5fa" }: { values: number[]; color?: string }) => {
  const w = 160, h = 36; const max = 100; const pts = values.length ? values : [0];
  const step = w / Math.max(pts.length - 1, 1);
  const points = pts.map((v, i) => `${i*step},${h - (Math.max(0, Math.min(max, v))/max)*h}`).join(' ');
  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
};

const SystemMonitor: React.FC<{ compact?: boolean }> = ({ compact=false }) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [cpuHist, setCpuHist] = useState<number[]>([]);
  const [memHist, setMemHist] = useState<number[]>([]);
  const [rxHist, setRxHist] = useState<number[]>([]);
  const [txHist, setTxHist] = useState<number[]>([]);
  const [diskIdx, setDiskIdx] = useState<number>(0);
  const [info, setInfo] = useState<any>(null);
  useEffect(() => { (async () => { try { setInfo(await api.systemInfo()); } catch {} })(); }, []);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const m = await api.systemMetrics();
        if (!alive) return; setMetrics(m);
        const memPctNow = 100 - (m.mem.free / m.mem.total * 100);
        setCpuHist(prev => [...prev.slice(-59), m.cpuPct]);
        setMemHist(prev => [...prev.slice(-59), memPctNow]);
        if (m.net) {
          setRxHist(prev => [...prev.slice(-59), (m.net.rxBps||0)/1024/1024*8]);
          setTxHist(prev => [...prev.slice(-59), (m.net.txBps||0)/1024/1024*8]);
        }
      } catch {}
    };
    tick(); const id = setInterval(tick, 2000); return () => { alive=false; clearInterval(id); };
  }, []);
  const memPct = metrics ? (100 - (metrics.mem.free/metrics.mem.total*100)) : 0;
  const diskPct = metrics?.disk ? (100 - (metrics.disk.free/(metrics.disk.total||1)*100)) : 0;
  const disks = metrics?.disks || [];
  const selDisk = disks[diskIdx] || disks[0];
  const selDiskPct = selDisk ? (100 - (selDisk.free/(selDisk.total||1)*100)) : 0;
  const fmtBps = (b?:number) => {
    if (!b && b!==0) return '—';
    const bits = b*8; // present as bits per second
    const units = ['bps','Kbps','Mbps','Gbps']; let i=0; let v=bits; while (v>=1000 && i<units.length-1){v/=1000;i++;}
    return `${v.toFixed(v<10?1:0)} ${units[i]}`;
  };
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 ${compact?'w-80':'w-full'}`}>
      <div className="flex items-center justify-between mb-2 text-sm">
        <div className="text-gray-700 dark:text-gray-300 font-semibold">Системный монитор</div>
        {info && (
          <div className="flex gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full ${info.dockerInstalled? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300':'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Docker {info.dockerInstalled? 'OK':''}</span>
            <span className={`px-2 py-0.5 rounded-full ${info.composeTool? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300':'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>Compose {info.composeTool||'—'}</span>
          </div>
        )}
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <div className="text-gray-600 dark:text-gray-300">CPU</div>
          <div className="text-gray-500">{metrics?metrics.cpuPct.toFixed(0):'—'}%</div>
        </div>
        <div className="flex items-center justify-between">
          <Sparkline values={cpuHist} color="#60a5fa" />
          <div className="ml-3 w-24"><Bar pct={metrics?.cpuPct||0} color="#60a5fa" /></div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-gray-600 dark:text-gray-300">RAM</div>
          <div className="text-gray-500">{metrics?fmtBytes(metrics.mem.total - metrics.mem.free):'—'} / {fmtBytes(metrics?.mem.total)}</div>
        </div>
        <div className="flex items-center justify-between">
          <Sparkline values={memHist} color="#34d399" />
          <div className="ml-3 w-24"><Bar pct={memPct} color="#34d399" /></div>
        </div>
        {metrics?.disk && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Диски (итого)</span>
              <span className="text-gray-500">{fmtBytes((metrics.disk.total||0)-(metrics.disk.free||0))} / {fmtBytes(metrics.disk.total)}</span>
            </div>
            <Bar pct={diskPct||0} color="#f59e0b" />
            {disks.length>0 && (
              <div className="flex items-center justify-between mt-2">
                <select className="bg-gray-100 dark:bg-gray-700 text-xs rounded px-2 py-1" value={diskIdx} onChange={(e)=>setDiskIdx(Number(e.target.value))}>
                  {disks.map((d,i)=> <option value={i} key={d.mount}>{d.mount}</option>)}
                </select>
                {selDisk && <span className="text-xs text-gray-500">{fmtBytes((selDisk.total||0)-(selDisk.free||0))} / {fmtBytes(selDisk.total)}</span>}
              </div>
            )}
            {selDisk && <Bar pct={selDiskPct||0} color="#fbbf24" />}
          </div>
        )}
        <div className="mt-2">
          <div className="flex items-center justify-between"><span className="text-gray-600 dark:text-gray-300">Сеть Rx</span><span className="text-gray-500">{fmtBps(metrics?.net?.rxBps)}</span></div>
          <div className="flex items-center justify-between"><Sparkline values={rxHist} color="#22d3ee" /><div className="ml-3 w-24" /></div>
          <div className="flex items-center justify-between mt-2"><span className="text-gray-600 dark:text-gray-300">Сеть Tx</span><span className="text-gray-500">{fmtBps(metrics?.net?.txBps)}</span></div>
          <div className="flex items-center justify-between"><Sparkline values={txHist} color="#a78bfa" /><div className="ml-3 w-24" /></div>
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;
