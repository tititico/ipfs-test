import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: any;
  unit?: string;
}

export const StatCard = ({
  title,
  value,
  icon: Icon,
  unit = '',
}: StatCardProps) => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm font-bold text-black mb-1">{title}</p>
      <div className="flex items-baseline gap-1">
        <h3 className="text-2xl font-black text-black">{value}</h3>
        {unit && <span className="text-sm text-black font-bold">{unit}</span>}
      </div>
    </div>
    <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
      <Icon className="w-6 h-6" />
    </div>
  </div>
);