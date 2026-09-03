import { z } from "zod";

// ---------------------------------------------------------------------------
// Disposable / throwaway email domains (top offenders)
// ---------------------------------------------------------------------------
const DISPOSABLE_DOMAINS = new Set([
  "guerrillamail.com", "guerrillamail.de", "guerrillamail.net",
  "tempmail.com", "throwaway.email", "temp-mail.org",
  "fakeinbox.com", "sharklasers.com", "guerrillamailblock.com",
  "grr.la", "dispostable.com", "yopmail.com", "yopmail.fr",
  "mailinator.com", "maildrop.cc", "trashmail.com", "trashmail.me",
  "trashmail.net", "trashmail.org", "trashmail.io",
  "10minutemail.com", "10minutemail.co.uk", "mintemail.com",
  "mailnesia.com", "mailcatch.com", "tempinbox.com",
  "tempail.com", "tempalias.com", "tempr.email",
  "discard.email", "discardmail.com", "discardmail.de",
  "mailnull.com", "mailslurp.com", "izzly.co.uk",
  "harakirimail.com", "jetable.org", "mailexpire.com",
  "mailforspam.com", "mailmoat.com", "mailscrap.com",
  "meltmail.com", "messagebeam.com", "my10minutemail.com",
  "noclickemail.com", "nospam.ze.tc", "nospamfor.us",
  "nowmymail.com", "owlpic.com", "proxymail.eu",
  "rcpt.at", "reallymymail.com", "recode.me",
  "regbypass.com", "safetymail.info", "sandelf.de",
  "saynotospams.com", "scatmail.com", "schafmail.de",
  "schrott-email.de", "secretemail.de", "sendspamhere.com",
  "shiftmail.com", "shitmail.me", "shitmail.org",
  "shitware.nl", "shmeriously.com", "shortmail.net",
  "sibmail.com", "sinnlos-mail.de", "skeefmail.com",
  "slaskpost.se", "slipry.net", "slopsbox.com",
  "slowslow.de", "slutty.horse", "smashmail.de",
  "smtp2go.com", "sogetthis.com", "soodonims.com",
  "spam4.me", "spamavert.com", "spambob.com",
  "spambob.net", "spambob.org", "spambog.com",
  "spambog.de", "spambog.ru", "spambogs.com",
  "spambogs.de", "spambog.info", "spambox.info",
  "spambox.irishspringrealty.com", "spambox.us",
  "spamcannon.com", "spamcannon.net", "spamcero.com",
  "spamcorptastic.com", "spamcowboy.com", "spamcowboy.net",
  "spamcowboy.org", "spamday.com", "spamex.com",
  "spamfighter.cf", "spamfighter.ga", "spamfighter.gq",
  "spamfighter.tk", "spamfree.eu", "spamfree24.com",
  "spamfree24.de", "spamfree24.eu", "spamfree24.info",
  "spamfree24.net", "spamfree24.org", "spamgenuis.com",
  "spamgoes.in", "spamgourmet.com", "spamgourmet.net",
  "spamgourmet.org", "spamherelots.com", "spamhereplease.com",
  "spamhole.com", "spamify.com", "spaminator.de",
  "spaml.com", "spaml.de", "spammotel.com",
  "spamobox.com", "spamoff.de", "spamslicer.com",
  "spamspot.com", "spamstack.net", "spamthis.co.uk",
  "spamthisplease.com", "spamtrail.com", "spamtrap.ro",
  "speed.1s.fr", "superrito.com", "superstachel.de",
  "suremail.info", "svk.jp", "sweetxxx.de",
  "talkinator.com", "tapchicuoihoi.com", "teewars.org",
  "teleworm.com", "teleworm.us", "temp-email.org",
  "temp-emails.com", "tempalias.com", "tempesta.com",
  "tempfd.com", "tempinbox.co.uk", "tempmail.eu",
  "tempmail.it", "tempmail2.com", "tempmaildemo.com",
  "tempmailer.com", "tempmailer.de", "tempomail.fr",
  "temporarily.de", "tempthe.net", "thankyou2010.com",
  "thc.st", "thecloudindex.com", "thetempmail.com",
  "throwawayemailaddress.com", "tittbit.in", "tizi.com",
  "tmailinator.com", "toiea.com", "toomail.biz",
  "tradermail.info", "trash-amil.com", "trash-dev.com",
  "trash-mail.at", "trash-mail.com", "trash-mail.de",
  "trash-me.com", "trash2009.com", "trashdevil.com",
  "trashdevil.de", "trashemail.de", "trashmail.at",
  "trashmail.com", "trashmail.de", "trashmail.me",
  "trashmail.net", "trashmail.org", "trashmailer.com",
  "trashymail.com", "trashymail.net", "trillianpro.com",
  "turual.com", "twinmail.de", "tyldd.com",
  "uggsrock.com", "umail.net", "upliftnow.com",
  "uplipht.com", "venompen.com", "veryreallyi.info",
  "vomoto.com", "vpn.st", "vsimcard.com",
  "vubby.com", "wasteland.rfc822.org", "webemail.me",
  "weg-werf-email.de", "wegwerfadresse.de", "wegwerfemail.com",
  "wegwerfemail.de", "wegwerfmail.de", "wegwerfmail.net",
  "wegwerfmail.org", "wetrainbayarea.com", "wetrainbayarea.org",
  "wh4f.org", "whatiaas.com", "whatpaas.com",
  "whyspam.me", "wickmail.net", "wilemail.com",
  "willhackforfood.biz", "willselfdestruct.com", "winemaven.info",
  "wronghead.com", "wuzup.net", "wuzupmail.net",
  "wwwnew.eu", "xagloo.com", "xemaps.com",
  "xents.com", "xjoi.com", "xmaily.com",
  "xoxy.net", "yapped.net", "yeah.net",
  "yep.it", "yogamaven.com", "yomail.info",
  "yopmail.com", "yopmail.fr", "yopmail.gq",
  "yorao.com", "you-spam.com", "ypmail.webarnak.fr",
  "yuurok.com", "zehnminutenmail.de", "1chuan.com",
  "maileater.com", "dacoolest.com", "dandikmail.com",
  "addressjuggler.com", "tempuramail.com", "emz.net",
  "hotsoup.is", "halfpriceortags.com",
]);

// ---------------------------------------------------------------------------
// Spam trigger words (low threshold — multiple matches = likely spam)
// ---------------------------------------------------------------------------
const SPAM_TRIGGERS = [
  "buy now", "click here", "order now", "limited time", "act now",
  "free money", "free gift", "winner", "congratulations", "you won",
  "viagra", "cialis", "casino", "lottery", "prize",
  "make money", "work from home", "earn cash", "double your",
  "nigerian prince", "bank transfer", "wire transfer",
  "http://", "https://", "www.", ".com/", ".co/",
  "unsubscribe", "opt out", "no obligation",
];

// ---------------------------------------------------------------------------
// Indian phone number validation
// ---------------------------------------------------------------------------
const INDIAN_PHONE_REGEX = /^(?:\+91|91|0)?[6-9]\d{9}$/;
const GENERAL_PHONE_REGEX = /^[+]?[\d\s\-()]{7,20}$/;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

export function isIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()+ ]/g, "");
  return INDIAN_PHONE_REGEX.test(cleaned);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()+ ]/g, "");
  return GENERAL_PHONE_REGEX.test(cleaned) && cleaned.length >= 7;
}

export function detectSpamScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  // Check spam trigger words
  for (const trigger of SPAM_TRIGGERS) {
    if (lower.includes(trigger)) score += 2;
  }

  // Repeated characters (e.g., "aaaaaaa" or "!!!!!!!")
  if (/(.)\1{5,}/.test(text)) score += 3;

  // ALL CAPS (more than 70% uppercase in a message > 10 chars)
  if (text.length > 10) {
    const upperCount = (text.match(/[A-Z]/g) ?? []).length;
    const letterCount = (text.match(/[a-zA-Z]/g) ?? []).length;
    if (letterCount > 10 && upperCount / letterCount > 0.7) score += 2;
  }

  // Excessive exclamation marks
  if ((text.match(/!/g) ?? []).length > 3) score += 1;

  // Multiple URLs
  const urlCount = (text.match(/https?:\/\//g) ?? []).length;
  if (urlCount > 2) score += 3;

  // Message is mostly links
  if (text.length > 0 && urlCount > 0) {
    const urlLength = urlCount * 30; // approximate
    if (urlLength / text.length > 0.5) score += 3;
  }

  return score;
}

export function isSpam(score: number): boolean {
  return score >= 5;
}

// ---------------------------------------------------------------------------
// Zod schemas for contact validation
// ---------------------------------------------------------------------------
export const contactNameSchema = z
  .string({ error: "Please enter your name." })
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(120, "Name is too long.")
  .regex(/^[a-zA-Z\s.'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes.");

export const contactEmailSchema = z
  .string({ error: "Please enter your email address." })
  .trim()
  .max(254, "Email is too long.")
  .transform((v) => v.toLowerCase())
  .pipe(z.email({ error: "Please enter a valid email address." }))
  .refine((email) => !isDisposableEmail(email), {
    message: "Please use a permanent email address (no disposable/throwaway emails).",
  });

export const contactPhoneSchema = z
  .string()
  .trim()
  .max(20, "Phone number is too long.")
  .optional()
  .or(z.literal(""))
  .refine(
    (phone) => !phone || isValidPhone(phone),
    { message: "Please enter a valid phone number (e.g., +91 98765 43210)." }
  );

export const contactSubjectSchema = z
  .string({ error: "Please enter a subject." })
  .trim()
  .min(2, "Subject must be at least 2 characters.")
  .max(120, "Subject is too long.")
  .refine(
    (s) => !/^(test|asdf|hello|hi|hey|asdfgh|qwerty)$/i.test(s),
    { message: "Please enter a meaningful subject." }
  );

export const contactMessageSchema = z
  .string({ error: "Please enter your message." })
  .trim()
  .min(10, "Message must be at least 10 characters.")
  .max(2000, "Message is too long.")
  .refine(
    (msg) => detectSpamScore(msg) < 5,
    { message: "Your message was flagged as potential spam. Please revise it." }
  );
