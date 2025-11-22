/* app/api/webhook/clerk/route.ts */
import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs";

import { connectToDatabase } from "@/lib/database/mongoose";
import { createUser, updateUser, deleteUser } from "@/lib/actions/user.actions";

// ---- Fix TypeScript undefined error + enforce runtime safety ----
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  throw new Error("Missing WEBHOOK_SECRET in environment variables");
}

// Create Svix instance safely
const wh = new Webhook(WEBHOOK_SECRET);

export async function POST(req: Request) {
  try {
    // 1. Read Svix headers safely
    const h = headers();
    const svixId = h.get("svix-id");
    const svixTimestamp = h.get("svix-timestamp");
    const svixSignature = h.get("svix-signature");

    // ---- Runtime guard fixes your TS error ----
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("Missing svix headers");
      return new Response("Missing svix headers", { status: 400 });
    }

    // 2. Raw body (required for signature verification)
    const body = await req.text();

    // 3. Verify signature
    let evt: WebhookEvent;
    try {
      evt = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as WebhookEvent;
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    // 4. Connect to DB
    try {
      await connectToDatabase();
    } catch (err) {
      console.error("MongoDB connection failed:", err);
      return new Response("DB connection error", { status: 500 });
    }

    const type = evt.type;
    const data: any = evt.data;

    // --------------------------
    //  HANDLE EVENTS
    // --------------------------

    // USER CREATED
    if (type === "user.created") {
      const primaryEmail =
        data.email_addresses?.find(
          (e: any) => e.id === data.primary_email_address_id
        )?.email_address ||
        data.email_addresses?.[0]?.email_address ||
        "";

      const userPayload = {
        clerkId: data.id,
        email: primaryEmail,
        username: data.username || data.id,
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        photo: data.image_url || data.profile_image_url || "",
      };

      const newUser = await createUser(userPayload);

      // Try updating Clerk metadata (optional, non-fatal)
      try {
        await clerkClient.users.updateUserMetadata(data.id, {
          publicMetadata: { userId: newUser._id.toString() },
        });
      } catch (metaErr) {
        console.error("Failed updating Clerk metadata:", metaErr);
        // Do not return error here
      }

      return NextResponse.json({
        ok: true,
        event: "user.created",
        user: newUser,
      });
    }

    // USER UPDATED
    if (type === "user.updated") {
      const updated = await updateUser(data.id, {
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        username: data.username || data.id,
        photo: data.image_url || "",
      });

      return NextResponse.json({
        ok: true,
        event: "user.updated",
        user: updated,
      });
    }

    // USER DELETED
    if (type === "user.deleted") {
      const deleted = await deleteUser(data.id);
      return NextResponse.json({
        ok: true,
        event: "user.deleted",
        user: deleted,
      });
    }

    return new Response("Unhandled event", { status: 200 });
  } catch (err) {
    console.error("Unexpected webhook error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
