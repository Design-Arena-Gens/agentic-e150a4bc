import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchMessages } from "@/lib/whatsapp";

const requestSchema = z.object({
  accessToken: z.string().min(1),
  phoneNumberId: z.string().min(1),
  limit: z.number().int().positive().optional(),
  cursor: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = requestSchema.parse(payload);
    const data = await fetchMessages(parsed);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.flatten() },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Unknown error" },
      { status: 500 },
    );
  }
}
