import { prisma } from "@/services/prismaClient";
import { ses } from "@/services/ses";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { verify, eventReferenceId, email } = await request.json() as {
    verify: string;
    eventReferenceId: string;
    email: string;
  };

  try {
    const url = new URL(verify);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("Error en LUD-21");
    const { settled } = await res.json() as { settled: boolean };
    if (settled) {
      // If settled, update order in Prisma
      await prisma.order.update({
        where: { eventReferenceId },
        data: { paid: true}
      });
      // If verified, send email to client
      await ses.sendEmailOrder(email, eventReferenceId);
      console.log("Payment via LUD-21 confirmed");
    }
    return NextResponse.json({ settled });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}