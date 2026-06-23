"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SensorData {
  time: string;
  value: number;
}

export function SensorChart({ data }: { data: SensorData[] }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[350px]">
      <h3 className="text-lg font-bold mb-4 text-slate-800">Live Gas Level (PPM)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            stroke="#64748b"
          />

          <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />

          <Tooltip
            isAnimationActive={false}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}