declare module 'lnurl' {
    export function encode(url: string): string;
    export function decode(lnurl: string): string;
    // Agrega más funciones si usás otras partes de la librería
  }