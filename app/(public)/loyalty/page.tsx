"use client";

import { useState } from "react";
import { useCart } from "@/hooks/use-cart";
import {
  Crown,
  Sparkles,
  Award,
  History,
  RotateCcw,
  CheckCircle,
  Search,
  ArrowRight,
} from "lucide-react";

interface LoyaltyOrder {
  id: string;
  orderNumber: string;
  total: number;
  diningMode: string;
  createdAt: string;
  items: {
    dishId: string | null;
    dishName: string;
    quantity: number;
    price: number;
    modifiers: {
      groupName: string;
      optionName: string;
      priceDelta: number;
    }[];
  }[];
}

interface LoyaltyLedgerEntry {
  id: string;
  pointsDelta: number;
  reason: string;
  createdAt: string;
}

interface LoyaltyProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  loyaltyPoints: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  tierName: string;
  tierPerks: string[];
  badgeColor: string;
  lifetimeSpend: number;
  nextTierThreshold: number | null;
  spendToNextTier: number;
  recentLedger: LoyaltyLedgerEntry[];
  recentOrders: LoyaltyOrder[];
}

export default function LoyaltyPage() {
  const { addItem, openCart } = useCart();

  const [emailInput, setEmailInput] = useState("");
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reorderedOrderId, setReorderedOrderId] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/v1/loyalty/profile?email=${encodeURIComponent(emailInput.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        setErrorMsg("Failed to retrieve loyalty profile");
      }
    } catch {
      setErrorMsg("Network error connecting to loyalty engine");
    } finally {
      setLoading(false);
    }
  };

  const handle1ClickReorder = (order: LoyaltyOrder) => {
    order.items.forEach((item, idx) => {
      addItem(
        {
          id: item.dishId || `${item.dishName}-${order.id}-${idx}`,
          dishId: item.dishId || undefined,
          name: item.dishName,
          slug: item.dishName.toLowerCase().replace(/\s+/g, "-"),
          price: item.price,
          modifiers: item.modifiers.map((m) => ({
            groupId: m.groupName,
            groupName: m.groupName,
            optionId: m.optionName,
            optionName: m.optionName,
            priceDelta: m.priceDelta,
          })),
        },
        item.quantity
      );
    });

    setReorderedOrderId(order.id);
    setTimeout(() => setReorderedOrderId(null), 3000);
    openCart();
  };

  return (
    <div className="min-h-[85vh] py-12 px-4 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <Crown className="w-3.5 h-3.5" />
            Maharaja Connoisseur Circle
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-serif text-foreground">
            VIP Loyalty & Rewards
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Earn 10 points per ₹100 spent, unlock complimentary chef starters, priority table seating, and 1-click reordering.
          </p>
        </div>

        {/* Email Lookup Card */}
        {!profile && (
          <div className="max-w-md mx-auto p-6 rounded-3xl bg-card border border-border shadow-xl space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold font-serif text-foreground">
                Access Your VIP Member Card
              </h2>
              <p className="text-xs text-muted-foreground">
                Enter your order email to view your tier points balance and reorder past favorites.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLookup} className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <span>{loading ? "Verifying..." : "View VIP Rewards"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Loaded Profile View */}
        {profile && (
          <div className="space-y-8">
            {/* VIP Glassmorphism Digital Member Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-amber-950/40 to-neutral-950 border border-amber-500/30 shadow-2xl p-6 sm:p-8 text-amber-100">
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-6">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-amber-400 uppercase">
                    SPICE & SAFFRON • PRIVILEGE CLUB
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white mt-1">
                    {profile.name}
                  </h2>
                  <div className="text-xs text-amber-200/70">{profile.email}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border shadow-sm ${profile.badgeColor}`}>
                    👑 {profile.tierName}
                  </span>
                </div>
              </div>

              {/* Points & Discount Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
                <div>
                  <div className="text-xs text-amber-300/80 font-medium">Available Balance</div>
                  <div className="text-3xl sm:text-4xl font-extrabold font-serif text-amber-400 mt-0.5">
                    {profile.loyaltyPoints}{" "}
                    <span className="text-sm font-normal text-amber-200/70">pts</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Worth ₹{Math.floor(profile.loyaltyPoints / 100) * 50} discount
                  </div>
                </div>

                <div>
                  <div className="text-xs text-amber-300/80 font-medium">Lifetime Dining Spend</div>
                  <div className="text-2xl font-bold font-serif text-white mt-0.5">
                    ₹{profile.lifetimeSpend.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-amber-200/70 mt-1">
                    {profile.nextTierThreshold
                      ? `₹${profile.spendToNextTier.toLocaleString()} to next tier`
                      : "Top Maharaja Tier Reached"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-amber-300/80 font-medium">Redemption Rule</div>
                  <div className="text-xs text-amber-100/90 mt-1 leading-relaxed">
                    100 pts = ₹50 off. Redeemable instantly at online checkout or table bill!
                  </div>
                </div>
              </div>

              {/* Tier Progress Bar */}
              {profile.nextTierThreshold && (
                <div className="mt-6 pt-6 border-t border-amber-500/20">
                  <div className="flex justify-between text-xs text-amber-300/80 mb-1.5 font-medium">
                    <span>Progress to Next Tier</span>
                    <span>
                      {Math.min(100, Math.round((profile.lifetimeSpend / profile.nextTierThreshold) * 100))}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-amber-950/60 border border-amber-500/30 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.round((profile.lifetimeSpend / profile.nextTierThreshold) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Unlocked Tier Perks */}
            <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
              <h3 className="text-base font-bold font-serif text-foreground flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                Unlocked {profile.tierName} Perks
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.tierPerks.map((perk, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-background border border-border flex items-center gap-2.5 text-xs font-medium text-foreground"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 1-Click Past Order Reorder Section */}
            <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold font-serif text-foreground flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-primary" />
                    1-Click Past Order Reorder
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Repeat your favorite royal meals in one tap. Items and modifiers populate your cart instantly.
                  </p>
                </div>
              </div>

              {profile.recentOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No past orders found under this account yet. Place your first order to enable 1-click reorder!
                </p>
              ) : (
                <div className="space-y-3">
                  {profile.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {order.orderNumber}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {order.diningMode.replace("_", " ")}
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            ₹{order.total.toFixed(0)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {order.items.map((it) => `${it.quantity}x ${it.dishName}`).join(", ")}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handle1ClickReorder(order)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>
                          {reorderedOrderId === order.id ? "Added to Cart!" : "1-Click Reorder"}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Points Ledger */}
            {profile.recentLedger.length > 0 && (
              <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
                <h3 className="text-base font-bold font-serif text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  Recent Points Activity
                </h3>
                <div className="divide-y divide-border text-xs">
                  {profile.recentLedger.map((ledger) => (
                    <div key={ledger.id} className="py-2.5 flex items-center justify-between">
                      <span className="text-foreground">{ledger.reason}</span>
                      <span
                        className={`font-mono font-bold ${
                          ledger.pointsDelta > 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {ledger.pointsDelta > 0 ? `+${ledger.pointsDelta}` : ledger.pointsDelta} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
