import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { verify } = await request.json() as {
    verify: string;
  };

  try {
    const url = new URL(verify);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("Error en LUD-21");
    const { settled } = await res.json() as { settled: boolean };
    return NextResponse.json({ settled });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}