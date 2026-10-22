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
  Hash,
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
  const [orderNumberInput, setOrderNumberInput] = useState("");
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reorderedOrderId, setReorderedOrderId] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailInput.trim();
    const orderNumber = orderNumberInput.trim();
    if (!email || !orderNumber) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams({ email, orderNumber });
      const res = await fetch(`/api/v1/loyalty/profile?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else if (res.status === 429) {
        setErrorMsg("Too many lookup attempts. Please wait a few minutes and try again.");
      } else if (res.status === 404) {
        setErrorMsg(
          "No loyalty profile found for those details. Check your email and a recent order number."
        );
      } else {
        setErrorMsg("We could not load your profile right now. Please try again in a moment.");
      }
    } catch {
      setErrorMsg("We could not reach the server. Check your connection and try again.");
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold">
            <Crown className="w-3.5 h-3.5" />
            Rewards for regulars
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-serif text-foreground">
            VIP Club
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Earn points on every order, unlock perks, and reorder past favourites in one tap.
          </p>
        </div>

        {/* Email Lookup Card */}
        {!profile && (
          <div className="max-w-md mx-auto p-6 rounded-3xl bg-card border border-border shadow-xl space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold font-serif text-foreground">
                Find your VIP card
              </h2>
              <p className="text-xs text-muted-foreground">
                Enter your order email and a recent order number to see your points and past orders.
              </p>
            </div>

            {errorMsg && (
              <div role="alert" id="loyalty-error" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLookup} className="space-y-4" aria-busy={loading}>
              <div>
                <label htmlFor="loyalty-email" className="mb-2 block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Search aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="loyalty-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  aria-describedby={errorMsg ? "loyalty-error" : undefined}
                  placeholder="you@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              </div>

              <div>
                <label htmlFor="loyalty-order" className="mb-2 block text-sm font-medium text-foreground">Order number</label>
              <div className="relative">
                <Hash aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="loyalty-order"
                  name="orderNumber"
                  type="text"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ORD-260101-AB12CD"
                  value={orderNumberInput}
                  onChange={(e) => setOrderNumberInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              </div>

              <p className="text-xs text-muted-foreground">
                A recent order number confirms the profile is yours.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <span>{loading ? "Checking" : "View my rewards"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {loading && !profile && (
          <div className="max-w-md mx-auto space-y-3" role="status" aria-label="Loading your profile">
            <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            <div className="h-10 animate-pulse rounded-xl bg-muted" />
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
                  <div className="text-xs tracking-widest text-amber-300">
                    SPICE & SAFFRON VIP CLUB
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-serif text-neutral-50 mt-1">
                    {profile.name}
                  </h2>
                  <div className="text-sm text-amber-200">{profile.email}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border shadow-sm ${profile.badgeColor}`}>
                    {profile.tierName}
                  </span>
                </div>
              </div>

              {/* Points & Discount Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
                <div>
                  <div className="text-sm text-amber-200 font-medium">Available Balance</div>
                  <div className="text-3xl sm:text-4xl font-extrabold font-serif text-amber-400 mt-0.5">
                    {profile.loyaltyPoints}{" "}
                    <span className="text-sm font-normal text-amber-200">pts</span>
                  </div>
                  <div className="text-xs text-emerald-300 mt-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Worth ₹{Math.floor(profile.loyaltyPoints / 100) * 50} discount
                  </div>
                </div>

                <div>
                  <div className="text-sm text-amber-200 font-medium">Lifetime Dining Spend</div>
                  <div className="text-2xl font-bold font-serif text-neutral-50 mt-0.5">
                    ₹{profile.lifetimeSpend.toLocaleString()}
                  </div>
                  <div className="text-xs text-amber-200 mt-1">
                    {profile.nextTierThreshold
                      ? `₹${profile.spendToNextTier.toLocaleString()} to next tier`
                      : "Top tier reached"}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-amber-200 font-medium">Redemption Rule</div>
                  <div className="text-sm text-amber-100 mt-1 leading-relaxed">
                    100 pts = ₹50 off. Redeemable at checkout or on a table bill.
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
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reorder a past order Section */}
            <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold font-serif text-foreground flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-primary" />
                    Reorder a past order
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add a past order to your bag in one tap.
                  </p>
                </div>
              </div>

              {profile.recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No past orders yet. Once you order, it will show up here for quick reordering.
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
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
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
                          {reorderedOrderId === order.id ? "Added to bag" : "Reorder"}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Points Ledger */}
            {profile.recentLedger.length === 0 && (
              <p className="rounded-3xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No points activity yet.
              </p>
            )}
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
                          ledger.pointsDelta > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
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
