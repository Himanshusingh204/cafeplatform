"use client";

import * as React from "react";
import { Star, MessageSquarePlus, CheckCircle2, X } from "lucide-react";
import { submitReviewAction } from "@/lib/actions/public";

export interface ReviewItem {
  id: string;
  customerName: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: Date | string;
}

interface ReviewsSectionProps {
  reviews: ReviewItem[];
  dishSlug?: string;
  title?: string;
  subtitle?: string;
}

export function ReviewsSection({
  reviews,
  dishSlug,
  title = "Words From Our Guests",
  subtitle = "Honest thoughts from those who pulled up a chair in Hauz Khas.",
}: ReviewsSectionProps) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [rating, setRating] = React.useState(5);
  const [reviewTitle, setReviewTitle] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await submitReviewAction({
      customerName: name,
      rating,
      title: reviewTitle,
      comment,
      dishSlug,
    });

    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Failed to submit review.");
    } else {
      setSubmitted(true);
      setName("");
      setReviewTitle("");
      setComment("");
    }
  }

  return (
    <section className="section-pad bg-muted/40 border-y border-border">
      <div className="container-site">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="eyebrow mb-2">Guest Testimonials</p>
            <h2 className="heading-display text-3xl md:text-4xl text-foreground">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-lg">{subtitle}</p>
          </div>

          <button
            onClick={() => {
              setSubmitted(false);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:bg-muted"
          >
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            <span>Leave a Review</span>
          </button>
        </div>

        {/* Reviews Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-2xl border border-border bg-card p-6 shadow-card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < rev.rating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted text-muted"
                      }`}
                    />
                  ))}
                </div>

                <h3 className="font-semibold text-foreground text-base mb-2">{rev.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground italic">
                  &ldquo;{rev.comment}&rdquo;
                </p>
              </div>

              <div className="border-t border-border/60 pt-4 mt-6 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{rev.customerName}</span>
                <span className="text-muted-foreground">Verified Diner</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Submission Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="heading-display text-2xl font-bold">Dhanyavaad!</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Thank you for sharing your feedback. Your review will appear on the site once moderated by our kitchen team.
                </p>
                <button
                  onClick={() => setModalOpen(false)}
                  className="mt-4 rounded-full bg-primary px-6 py-2 text-xs font-semibold text-primary-foreground"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="heading-display text-xl font-bold text-foreground">
                  Share Your Dining Experience
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tell us what made your meal memorable at Spice & Saffron.
                </p>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Your Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`h-6 w-6 ${
                            star <= rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted hover:text-amber-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sanya Gupta"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Headline / Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Incredible Dal Makhani and lovely ambience"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Your Review *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Tell us about the flavours, hospitality, and your favourite dishes..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Post Review for Verification"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
