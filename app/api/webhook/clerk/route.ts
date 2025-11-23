/* app/api/webhook/clerk/route.ts  — DEV debug helper (remove after use) */
import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs";

import { connectToDatabase } from "@/lib/database/mongoose";
import { createUser, updateUser, deleteUser } from "@/lib/actions/user.actions";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) throw new Error("Missing WEBHOOK_SECRET");

const wh = new Webhook(WEBHOOK_SECRET);

export async function POST(req: Request) {
  try {
    // 1. Get headers & raw body
    const h = headers();
    const svixId = h.get("svix-id");
    const svixTimestamp = h.get("svix-timestamp");
    const svixSignature = h.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("Missing svix headers", { svixId, svixTimestamp, svixSignature });
      return new Response("Missing svix headers", { status: 400 });
    }

    const body = await req.text();

    // 2. Verify signature
    let evt: WebhookEvent;
    try {
      evt = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as WebhookEvent;
    } catch (err) {
      console.error("Signature verify failed:", err);
      return new Response("Invalid signature: " + String(err), { status: 400 });
    }

    // 3. Connect to DB (you said this succeeds)
    try {
      await connectToDatabase();
    } catch (err) {
      console.error("DB connect failed:", err);
      // return the message so Clerk shows it
      return new Response("DB connect failed: " + (err as any).message || String(err), { status: 500 });
    }

    // 4. Log event data (very useful)
    console.log("Webhook event type:", evt.type);
    console.log("Webhook event data (truncated):", JSON.stringify(evt.data).slice(0, 3000));

    // 5. Handle types with guarded try/catch blocks so we can see any thrown error
    const d: any = evt.data;

    if (evt.type === "user.created") {
      try {
        // robust primary email extraction
        let primaryEmail = "";
        if (d.primary_email_address_id && Array.isArray(d.email_addresses)) {
          const found = d.email_addresses.find((e: any) => e.id === d.primary_email_address_id);
          primaryEmail = found?.email_address ?? d.email_addresses?.[0]?.email_address ?? "";
        } else {
          primaryEmail = d.email_addresses?.[0]?.email_address ?? "";
        }

        const userPayload = {
          clerkId: d.id,
          email: primaryEmail || `${d.id}@no-email.local`,
          username: d.username || d.id,
          firstName: d.first_name || "",
          lastName: d.last_name || "",
          photo: d.image_url || d.profile_image_url || "",
        };

        console.log("createUser payload:", JSON.stringify(userPayload));

        let newUser;
        try {
          newUser = await createUser(userPayload);
        } catch (createErr) {
          console.error("createUser threw:", createErr);
          // return the error so Clerk shows it
          return new Response("createUser error: " + ((createErr as any).message || String(createErr)), { status: 500 });
        }

        // ensure serializable before returning
        const safeUser = JSON.parse(JSON.stringify(newUser));

        // update clerk metadata — wrap in try/catch (common failure if server key missing)
        try {
          await clerkClient.users.updateUserMetadata(d.id, {
            publicMetadata: { userId: safeUser._id ? String(safeUser._id) : "unknown" },
          });
        } catch (metaErr) {
          console.error("clerkClient.updateUserMetadata failed:", metaErr);
          // Return this error to show what's wrong (dev-only).
          return new Response("clerk update metadata error: " + ((metaErr as any).message || String(metaErr)), { status: 500 });
        }

        return NextResponse.json({ ok: true, user: safeUser });
      } catch (err) {
        console.error("Unhandled user.created error:", err);
        return new Response("Unhandled user.created error: " + ((err as any).message || String(err)), { status: 500 });
      }
    }

    if (evt.type === "user.updated") {
      try {
        const updated = await updateUser(d.id, {
          firstName: d.first_name || "",
          lastName: d.last_name || "",
          username: d.username || d.id,
          photo: d.image_url || "",
        });
        return NextResponse.json({ ok: true, updated: JSON.parse(JSON.stringify(updated)) });
      } catch (err) {
        console.error("updateUser error:", err);
        return new Response("updateUser error: " + ((err as any).message || String(err)), { status: 500 });
      }
    }

    if (evt.type === "user.deleted") {
      try {
        const deleted = await deleteUser(d.id);
        return NextResponse.json({ ok: true, deleted: JSON.parse(JSON.stringify(deleted)) });
      } catch (err) {
        console.error("deleteUser error:", err);
        return new Response("deleteUser error: " + ((err as any).message || String(err)), { status: 500 });
      }
    }

    return new Response("Unhandled event", { status: 200 });
  } catch (err) {
    console.error("Unexpected top-level error:", err);
    return new Response("Unexpected error: " + ((err as any).message || String(err)), { status: 500 });
  }
}
