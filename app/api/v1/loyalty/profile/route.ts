import { NextResponse } from "next/server";
import { getCustomerLoyaltyProfile, findOrCreateCustomer } from "@/lib/services/loyalty";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json(
        { error: "Email query param is required" },
        { status: 400 }
      );
    }

    let profile = await getCustomerLoyaltyProfile(email);
    if (!profile) {
      const customer = await findOrCreateCustomer({
        email,
        name: email.split("@")[0].replace(/[^a-zA-Z]/g, " ") || "Valued Guest",
      });
      profile = await getCustomerLoyaltyProfile(customer.id);
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Loyalty profile lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
