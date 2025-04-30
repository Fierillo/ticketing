// src/components/ui/block-bar.tsx
import { blockPrice } from '@/lib/utils/blockPrice'
import React from 'react'

interface BlockBarProps {
  totalSquares: number   // cantidad total de cuadrados
  filled: number         // cuántos deben pintarse como “completados”
  sizePx?: number        // ancho/alto de cada cuadrado en píxeles (por defecto 8)
  gapPx?: number         // separación entre cuadrados en píxeles (por defecto 4)
}

export function BlockBar({
  totalSquares,
  filled,
  sizePx = 15,
  gapPx = 8,
}: BlockBarProps) {
  // genera un array [0…totalSquares-1]
  const squares = Array.from({ length: totalSquares }, (_, i) => i)

  return (
    <div className="flex justify-between items-center w-full" style={{ gap: gapPx }}>
      {squares.map((idx) => (
        <div
          key={idx}
          className={idx < filled ? 'bg-orange-400' : 'bg-gray-300'}
          style={{
            width: sizePx,
            height: sizePx,
            borderRadius: 2,
          }}
        />
      ))}
      <span className="flex text-xs ml-auto text-right text-orange-400 font-bold">
        Bloque {filled}
      </span>
    </div>
  )
}