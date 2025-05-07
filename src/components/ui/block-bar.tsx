// src/components/ui/block-bar.tsx
import React from 'react';

interface BlockBarProps {
  totalSquares: number; // cantidad total de cuadrados
  filled: number; // cuántos deben pintarse como “completados”
  totalTickets?: number; // total de tickets
}

export function BlockBar({
  totalSquares,
  filled,
  totalTickets = 0,
}: BlockBarProps) {
  // genera un array [0…totalSquares-1]
  const squares = Array.from({ length: totalSquares }, (_, i) => i);

  return (
    <div
      className="flex flex-col justify-between items-center w-full mt-2"
      style={{ gap: '8px' }}
    >
      <div className="flex gap-2 w-full">
        {squares.map((idx) => (
          <div
            key={idx}
            className={`relative w-full  ${
              idx < filled
                ? 'opacity-100'
                : idx < filled
                  ? 'opacity-80'
                  : 'opacity-50'
            }`}
          >
            <div
              className={`h-2 w-full ${idx < filled ? 'bg-orange-400' : 'bg-gray-300'} rounded-full overflow-hidden relative`}
            >
              <div
                className={`h-full ${'bg-gradient-to-r from-brand-green to-brand-green/80'}`}
                // style={{ width: `${percentageSold}%` }}
                // animate={{ width: `${percentageSold}%` }}
                // transition={{ duration: 1, ease: 'easeOut' }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 justify-end w-full text-xs text-orange-400 font-bold">
        <span>Bloque</span>
        <span>{filled === 0 ? 'Génesis' : '#' + filled}</span>
      </div>
    </div>
  );
}
