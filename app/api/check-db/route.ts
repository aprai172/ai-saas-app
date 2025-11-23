import { connectToDatabase } from "@/lib/database/mongoose";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("Testing database connection...");
    await connectToDatabase();
    console.log("Database connection successful!");

    return NextResponse.json({
      success: true,
      message: "Database connected successfully!",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Database connection failed",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}