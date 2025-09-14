import React from 'react';

const daysShort = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const CalendarMonth: React.FC<{ date?: Date }> = ({ date = new Date() }) => {
  const y = date.getFullYear(); const m = date.getMonth();
  const first = new Date(y, m, 1); const startIdx = (first.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const cells = [] as { d: number|null, isToday: boolean }[];
  for (let i=0;i<startIdx;i++) cells.push({ d: null, isToday: false });
  for (let d=1; d<=daysInMonth; d++) {
    const isToday = d === new Date().getDate() && m === new Date().getMonth() && y === new Date().getFullYear();
    cells.push({ d, isToday });
  }
  while (cells.length % 7) cells.push({ d: null, isToday: false });
  const monthName = date.toLocaleString('ru-RU', { month: 'long' });
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 text-sm text-gray-600 dark:text-gray-300">
        <div className="font-semibold capitalize">{monthName} {y}</div>
        <div className="flex gap-2">{daysShort.map(d => <div key={d} className="w-6 text-center text-xs">{d}</div>)}</div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => (
          <div key={i} className={`h-6 text-xs flex items-center justify-center rounded ${c.isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
            {c.d || ''}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarMonth;

