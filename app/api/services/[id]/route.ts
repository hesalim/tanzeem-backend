import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser, requireActiveUser, requireOwner } from "@/lib/auth";

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
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

    const { id } = await context.params;
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
      UPDATE services
      SET
        name = ?,
        description = ?,
        price = ?,
        duration_minutes = ?,
        booking_type = ?,
        max_participants = ?
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      `,
      [
        name.trim(),
        description?.trim() || null,
        price,
        duration_minutes,
        booking_type,
        booking_type === "GROUP" ? max_participants : null,
        id,
        auth.businessId,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Service not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Service updated successfully",
    });
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

    if (error.message === "STAFF_ACCOUNT_NOT_LINKED") {
      return NextResponse.json(
        { message: "Staff account is not linked correctly" },
        { status: 403 },
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { message: "Owner access required" },
        { status: 403 },
      );
    }

    console.error("PUT service error:", error);

    return NextResponse.json(
      { message: "Failed to update service" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
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

    const { id } = await context.params;

    const [result]: any = await pool.query(
      `
      UPDATE services
      SET
        is_active = FALSE
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      `,
      [id, auth.businessId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Service not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Service deleted successfully",
    });
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

    if (error.message === "STAFF_ACCOUNT_NOT_LINKED") {
      return NextResponse.json(
        { message: "Staff account is not linked correctly" },
        { status: 403 },
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { message: "Owner access required" },
        { status: 403 },
      );
    }

    console.error("PATCH service error:", error);

    return NextResponse.json(
      { message: "Failed to delete service" },
      { status: 500 },
    );
  }
}
