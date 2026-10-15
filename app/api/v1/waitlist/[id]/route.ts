import { NextResponse } from "next/server";
import { getPublicWaitlistPosition } from "@/lib/services/waitlist";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const position = await getPublicWaitlistPosition(id);

    if (!position) {
      return NextResponse.json(
        { error: "Waitlist entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(position);
  } catch (error) {
    console.error("Waitlist public lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
