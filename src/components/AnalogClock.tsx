import React, { useEffect, useState } from 'react';

const AnalogClock: React.FC<{ size?: number }> = ({ size = 140 }) => {
  const [date, setDate] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setDate(new Date()), 1000); return () => clearInterval(id); }, []);
  const sec = date.getSeconds(); const min = date.getMinutes(); const hr = date.getHours()%12;
  const secDeg = sec * 6; const minDeg = (min + sec/60) * 6; const hrDeg = (hr + min/60) * 30;
  const c = size/2; const r = c - 8;
  const hand = (w: number, l: number, rot: number, color: string) => (
    <line x1={c} y1={c} x2={c} y2={c-l} stroke={color} strokeWidth={w} strokeLinecap="round" transform={`rotate(${rot} ${c} ${c})`} />
  );
  const marks = Array.from({length:60}, (_,i)=>i).map(i => {
    const ang = i*6*Math.PI/180; const len = i%5===0?10:5; const x1 = c + (r-2) * Math.sin(ang); const y1 = c - (r-2) * Math.cos(ang);
    const x2 = c + (r-len) * Math.sin(ang); const y2 = c - (r-len) * Math.cos(ang);
    const w = i%5===0?2:1; return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth={w} />;
  });
  return (
    <svg width={size} height={size} className="text-gray-700 dark:text-gray-200">
      <circle cx={c} cy={c} r={r} fill="#fff" className="dark:fill-gray-800" stroke="#cbd5e1" />
      {marks}
      {hand(4, r*0.55, hrDeg, '#0ea5e9')}
      {hand(3, r*0.75, minDeg, '#0ea5e9')}
      {hand(2, r*0.85, secDeg, '#ef4444')}
      <circle cx={c} cy={c} r={3} fill="#0ea5e9" />
    </svg>
  );
};

export default AnalogClock;

