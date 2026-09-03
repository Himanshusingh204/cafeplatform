"use client";

import { useState, useTransition } from "react";
import {
  generateApiKeyAction,
  revokeApiKeyAction,
  createWebhookSubscriptionAction,
  deleteWebhookSubscriptionAction,
} from "@/app/admin/actions/developer";
import { AVAILABLE_SCOPES, type ApiScope } from "@/config/s2s";

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | Date | null;
  createdAt: string | Date;
  isActive: boolean;
}

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  createdAt: string | Date;
  isActive: boolean;
}

interface DeveloperPortalProps {
  apiKeys: ApiKeyItem[];
  webhooks: WebhookItem[];
}

export function DeveloperPortal({ apiKeys, webhooks }: DeveloperPortalProps) {
  const [activeTab, setActiveTab] = useState<"keys" | "webhooks" | "docs">("keys");
  const [isPending, startTransition] = useTransition();

  // API Key creation modal state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>([
    "orders:read",
    "orders:write",
    "menu:read",
  ]);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Webhook creation modal state
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    "order.created",
    "order.status_changed",
  ]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  const toggleScope = (scope: ApiScope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError(null);

    startTransition(async () => {
      const res = await generateApiKeyAction(keyName, selectedScopes);
      if (res.ok && res.apiKey) {
        setNewGeneratedKey(res.apiKey);
        setKeyName("");
      } else {
        setKeyError(res.error || "Failed to generate key");
      }
    });
  };

  const handleRevokeKey = (id: string) => {
    if (!confirm("Are you sure you want to revoke this API Key? Any external POS or S2S system using it will immediately lose access.")) {
      return;
    }
    startTransition(async () => {
      await revokeApiKeyAction(id);
    });
  };

  const handleCreateWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    setWebhookError(null);

    startTransition(async () => {
      const res = await createWebhookSubscriptionAction(webhookUrl, webhookEvents);
      if (res.ok && res.secret) {
        setCreatedSecret(res.secret);
        setWebhookUrl("");
      } else {
        setWebhookError(res.error || "Failed to create webhook");
      }
    });
  };

  const handleDeleteWebhook = (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook endpoint?")) return;
    startTransition(async () => {
      await deleteWebhookSubscriptionAction(id);
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-card border border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                S2S & M2M Gateway
              </span>
              <h1 className="text-2xl font-bold font-serif text-foreground">Developer & API Gateway</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Issue cryptographically hashed API Keys for POS integrations, configure HMAC-SHA256 webhooks, and inspect B2B endpoints.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowKeyModal(true);
                setNewGeneratedKey(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm flex items-center gap-1.5"
            >
              + Issue API Key
            </button>
            <button
              type="button"
              onClick={() => {
                setShowWebhookModal(true);
                setCreatedSecret(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border transition-all flex items-center gap-1.5"
            >
              + Add Webhook
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "keys"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            API Keys ({apiKeys.filter((k) => k.isActive).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("webhooks")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "webhooks"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Webhooks ({webhooks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("docs")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "docs"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            S2S Endpoint Specs & cURL
          </button>
        </div>
      </div>

      {/* Tab Content: API Keys */}
      {activeTab === "keys" && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/20">
            <h2 className="font-semibold text-sm text-foreground">Active Server-to-Server (S2S) Keys</h2>
            <p className="text-xs text-muted-foreground">
              Secret keys are stored securely using SHA-256 hashes and verified in constant time.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Key Identifier</th>
                  <th className="py-3 px-4 font-semibold">Granted Scopes</th>
                  <th className="py-3 px-4 font-semibold">Last Used</th>
                  <th className="py-3 px-4 font-semibold">Created</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {apiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No API keys generated yet. Click &quot;+ Issue API Key&quot; to connect external POS or delivery services.
                    </td>
                  </tr>
                ) : (
                  apiKeys.map((key) => (
                    <tr key={key.id} className={!key.isActive ? "opacity-40" : ""}>
                      <td className="py-3 px-4 font-semibold text-foreground">{key.name}</td>
                      <td className="py-3 px-4 font-mono text-primary font-bold">
                        {key.keyPrefix}...
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {key.isActive ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRevokeKey(key.id)}
                            className="text-rose-400 hover:text-rose-300 font-semibold text-xs transition-colors"
                          >
                            Revoke
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">Revoked</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Webhooks */}
      {activeTab === "webhooks" && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/20">
            <h2 className="font-semibold text-sm text-foreground">Configured Webhook Endpoints</h2>
            <p className="text-xs text-muted-foreground">
              Every dispatched event includes an <code className="font-mono text-primary">X-Spice-Signature</code> HMAC-SHA256 header.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold">Destination URL</th>
                  <th className="py-3 px-4 font-semibold">Events</th>
                  <th className="py-3 px-4 font-semibold">Created</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {webhooks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No webhook endpoints configured. Click &quot;+ Add Webhook&quot; to subscribe to real-time events.
                    </td>
                  </tr>
                ) : (
                  webhooks.map((wh) => (
                    <tr key={wh.id}>
                      <td className="py-3 px-4 font-mono font-medium text-foreground">{wh.url}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((ev) => (
                            <span key={ev} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                              {ev}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(wh.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="text-rose-400 hover:text-rose-300 font-semibold text-xs transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: S2S Documentation & cURL */}
      {activeTab === "docs" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-xs">GET</span>
              Sync Menu Catalog
            </h3>
            <p className="text-xs text-muted-foreground">
              Retrieve categories, dishes, prices, and dietary flags for POS or third-party digital signage.
            </p>
            <div className="p-3 rounded-xl bg-background border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto">
              curl -X GET https://cafeplatform.vercel.app/api/v1/menu \<br />
              &nbsp;&nbsp;-H &quot;Authorization: Bearer sp_live_your_key_here&quot;
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-xs">POST</span>
              Ingest Order from POS / Partner
            </h3>
            <p className="text-xs text-muted-foreground">
              Places an order directly into the restaurant workflow and alerts the Kitchen Display System (KDS) instantly.
            </p>
            <div className="p-3 rounded-xl bg-background border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto">
              curl -X POST https://cafeplatform.vercel.app/api/v1/orders \<br />
              &nbsp;&nbsp;-H &quot;Authorization: Bearer sp_live_your_key_here&quot; \<br />
              &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br />
              &nbsp;&nbsp;-d &apos;{JSON.stringify({
                customerName: "Rahul Sharma",
                customerEmail: "rahul@example.com",
                customerPhone: "+919876543210",
                pickupTime: "19:30",
                items: [{ dishName: "Butter Chicken", quantity: 1, price: 545 }]
              })}&apos;
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono text-xs">STREAM</span>
              Real-Time Kitchen Display Stream
            </h3>
            <p className="text-xs text-muted-foreground">
              Connect persistent hardware screens to receive instant order events without polling.
            </p>
            <div className="p-3 rounded-xl bg-background border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto">
              curl -N https://cafeplatform.vercel.app/api/v1/realtime/kds \<br />
              &nbsp;&nbsp;-H &quot;Authorization: Bearer sp_live_your_key_here&quot;
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-xs">WEBHOOK</span>
              Inbound Partner Webhook Receiver
            </h3>
            <p className="text-xs text-muted-foreground">
              External systems can notify our platform of delivery status updates and payment lifecycle events.
            </p>
            <div className="p-3 rounded-xl bg-background border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto">
              POST /api/v1/webhooks/ingress<br />
              Headers: X-Spice-Signature: t=1725412800,v1=&lt;hmac&gt;
            </div>
          </div>
        </div>
      )}

      {/* Modal: Generate API Key */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-foreground">Issue New S2S API Key</h3>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {newGeneratedKey ? (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  ⚠️ <strong>Save this key immediately!</strong> It will never be displayed again. If lost, you must revoke it and issue a new one.
                </div>

                <div className="p-3 rounded-xl bg-background border border-border font-mono text-xs text-primary break-all">
                  {newGeneratedKey}
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(newGeneratedKey)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                >
                  {copiedKey ? "✓ Copied to Clipboard!" : "📋 Copy Secret API Key"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleGenerateKey} className="space-y-4">
                {keyError && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                    {keyError}
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Key Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Toast POS Production Connector"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Permission Scopes</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {AVAILABLE_SCOPES.map((scope) => (
                      <label
                        key={scope}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedScopes.includes(scope)
                            ? "bg-primary/10 border-primary/40 text-foreground"
                            : "bg-background border-border text-muted-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                          className="rounded text-primary"
                        />
                        <span className="font-mono text-[11px]">{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    {isPending ? "Generating..." : "Generate Key"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Webhook */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-foreground">Configure Webhook Endpoint</h3>
              <button
                type="button"
                onClick={() => setShowWebhookModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {createdSecret ? (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  ✓ Webhook created! Use this signing secret to verify signatures in your handler.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Webhook Secret (HMAC):</label>
                  <div className="p-3 rounded-xl bg-background border border-border font-mono text-xs text-primary break-all">
                    {createdSecret}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(createdSecret)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                >
                  {copiedKey ? "✓ Copied Secret!" : "📋 Copy Webhook Secret"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateWebhook} className="space-y-4">
                {webhookError && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                    {webhookError}
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Endpoint URL (HTTPS)</label>
                  <input
                    type="url"
                    required
                    placeholder="https://your-server.com/api/webhooks"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Subscribed Events</label>
                  <div className="space-y-2 text-xs">
                    {["order.created", "order.status_changed", "reservation.created"].map((ev) => (
                      <label
                        key={ev}
                        className="flex items-center gap-2 p-2 rounded-lg border border-border bg-background cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={webhookEvents.includes(ev)}
                          onChange={() =>
                            setWebhookEvents((prev) =>
                              prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
                            )
                          }
                          className="rounded text-primary"
                        />
                        <span className="font-mono text-xs">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWebhookModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    {isPending ? "Creating..." : "Add Endpoint"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
