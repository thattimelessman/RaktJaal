import { createElement as h } from "react";
import { ImageResponse } from "next/og";
import { EMAIL_ASSETS } from "@/backend/lib/emailAssets";

/**
 * Draws the REAL one-time code into the six boxes of the OTP email's hero
 * illustration. The base image (public/email/hero/otp.png) has empty boxes; this
 * overlays the digits and returns a PNG that mailer attaches inline (cid:rj-hero-otp).
 *
 * Box geometry was measured from the 608x404 base image: six 43x56 boxes, 47px pitch.
 * Digits use Arimo Bold (SIL OFL), subset to 0-9 and embedded below (~2 KB).
 * Returns null on any failure — the caller then falls back to the plain base image
 * (empty boxes); the code is still in the email body either way.
 */

// Arimo Bold, digits only (OFL-1.1, https://github.com/googlefonts/arimo)
const DIGIT_FONT_B64 =
  "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";

const BOX_X = [167, 214, 261, 308, 355, 402];
const BOX_Y = 175;
// Text sits ~4px low when centred in the box (font ascent/descent), so nudge it up.
const TEXT_NUDGE_Y = -4;
const BOX_W = 43;
const BOX_H = 56;

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const buf = Buffer.from(b64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function renderOtpHero(code: string): Promise<Buffer | null> {
  if (!/^\d{6}$/.test(code)) return null;
  try {
    const base = EMAIL_ASSETS["rj-hero-otp"];
    const element = h(
      "div",
      { style: { display: "flex", position: "relative", width: 608, height: 404 } },
      h("img", {
        src: `data:image/png;base64,${base}`,
        width: 608,
        height: 404,
        style: { position: "absolute", left: 0, top: 0 },
      }),
      ...code.split("").map((digit, i) =>
        h(
          "div",
          {
            key: i,
            style: {
              position: "absolute",
              left: BOX_X[i],
              top: BOX_Y + TEXT_NUDGE_Y,
              width: BOX_W,
              height: BOX_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Arimo",
              fontWeight: 700,
              fontSize: 25,
              color: "#111111",
            },
          },
          digit
        )
      )
    );
    const res = new ImageResponse(element, {
      width: 608,
      height: 404,
      fonts: [{ name: "Arimo", data: b64ToArrayBuffer(DIGIT_FONT_B64), weight: 700, style: "normal" }],
    });
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.warn("OTP hero image generation failed, using static image:", e);
    return null;
  }
}
