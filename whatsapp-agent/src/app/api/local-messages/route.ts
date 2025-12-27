import { NextResponse } from "next/server";
import { webhookStore } from "@/lib/webhookStore";

export async function GET() {
  return NextResponse.json({
    messages: webhookStore.getAll(),
  });
}

export async function DELETE() {
  webhookStore.clear();
  return NextResponse.json({ success: true });
}
