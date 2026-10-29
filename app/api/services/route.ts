import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser, requireOwner, requireActiveUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);

    if (auth.businessId == null) {
      return NextResponse.json(
        { message: "Business setup is required" },
        { status: 403 },
      );
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        business_id,
        name,
        description,
        price,
        duration_minutes,
        booking_type,
        max_participants,
        is_active
      FROM services
      WHERE business_id = ?
        AND is_active = TRUE
      ORDER BY name
      `,
      [auth.businessId],
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { message: "This account is inactive" },
        { status: 403 },
      );
    }

    console.error("GET services error:", error);

    return NextResponse.json(
      { message: "Failed to load services" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);

    requireOwner(auth);

    if (auth.businessId == null) {
      return NextResponse.json(
        { message: "Business setup is required" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const {
      name,
      description,
      price,
      duration_minutes,
      booking_type,
      max_participants,
    } = body;

    if (!name || price == null || duration_minutes == null || !booking_type) {
      return NextResponse.json(
        {
          message: "Name, price, duration and booking type are required",
        },
        { status: 400 },
      );
    }

    if (
      booking_type === "GROUP" &&
      (!max_participants || max_participants <= 0)
    ) {
      return NextResponse.json(
        {
          message: "Maximum participants is required for group services",
        },
        { status: 400 },
      );
    }

    const [result]: any = await pool.query(
      `
      INSERT INTO services (
        business_id,
        name,
        description,
        price,
        duration_minutes,
        booking_type,
        max_participants,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
      `,
      [
        auth.businessId,
        name.trim(),
        description?.trim() || null,
        price,
        duration_minutes,
        booking_type,
        booking_type === "GROUP" ? max_participants : null,
      ],
    );

    return NextResponse.json(
      {
        message: "Service created successfully",
        serviceId: result.insertId,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { message: "This account is inactive" },
        { status: 403 },
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { message: "Owner access required" },
        { status: 403 },
      );
    }

    console.error("POST service error:", error);

    return NextResponse.json(
      { message: "Failed to create service" },
      { status: 500 },
    );
  }
}
