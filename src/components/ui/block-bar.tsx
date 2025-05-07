// src/components/ui/block-bar.tsx
import React from 'react';

interface BlockBarProps {
  totalTickets?: number; // total de tickets
}

const BLOCK_SIZE = 21;

export function BlockBar({ totalTickets = 0 }: BlockBarProps) {
  // genera un array [0…totalSquares-1]
  const totalSquares = Math.ceil((totalTickets + 1) / BLOCK_SIZE);
  const squares = Array.from({ length: totalSquares }, (_, i) => i);
  const lastSquareFilledPercentage =
    ((totalTickets % BLOCK_SIZE) * 100) / BLOCK_SIZE;
  const currentBlock = Math.floor(totalTickets / BLOCK_SIZE);

  return (
    <div
      className="flex flex-col justify-between items-center w-full mt-2"
      style={{ gap: '8px' }}
    >
      <div className="flex gap-2 w-full">
        {squares.map((idx) => (
          <div key={idx} className={`relative w-full opacity-100`}>
            <div
              className={`h-2 w-full bg-gray-600 rounded-full overflow-hidden relative`}
            >
              <div
                className={`h-full bg-gradient-to-r bg-green-400 transition-all duration-300 ease-in-out`}
                style={{
                  width: `${idx < currentBlock ? '100' : lastSquareFilledPercentage}%`,
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 justify-end w-full text-sm text-green-400 font-bold mt-1">
        <span>Bloque</span>
        <span>{currentBlock === 0 ? 'Génesis' : '#' + currentBlock}</span>
      </div>
      <div className="flex gap-1 justify-end w-full text-xs font-bold">
        <span>Próximo: #{totalTickets}</span>
      </div>
    </div>
  );
}
