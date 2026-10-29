import { NextResponse } from "next/server";
import pool from "@/lib/db";

import { getAuthUser, requireActiveUser, requireOwner } from "@/lib/auth";

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

    const { searchParams } = new URL(request.url);

    let staffId = Number(searchParams.get("staffId"));

    // STAFF can only load their own time off
    if (auth.role === "STAFF") {
      if (auth.staffId == null) {
        return NextResponse.json(
          {
            message: "Staff account is not linked correctly",
          },
          { status: 403 },
        );
      }

      staffId = auth.staffId;
    } else if (auth.role === "OWNER") {
      if (!staffId) {
        return NextResponse.json(
          {
            message: "Staff ID is required",
          },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        {
          message: "Access denied",
        },
        { status: 403 },
      );
    }

    const [staffRows]: any = await pool.query(
      `
        SELECT id
        FROM staff
        WHERE id = ?
          AND business_id = ?
          AND is_active = TRUE
        LIMIT 1
        `,
      [staffId, auth.businessId],
    );

    if (staffRows.length === 0) {
      return NextResponse.json(
        {
          message: "Team member not found",
        },
        { status: 404 },
      );
    }

    const [rows] = await pool.query(
      `
        SELECT
          id,
          staff_id,
          start_at,
          end_at,
          reason
        FROM staff_time_off
        WHERE staff_id = ?
        ORDER BY start_at
        `,
      [staffId],
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        {
          message: "This account is inactive",
        },
        { status: 403 },
      );
    }

    if (error.message === "STAFF_ACCOUNT_NOT_LINKED") {
      return NextResponse.json(
        {
          message: "Staff account is not linked correctly",
        },
        { status: 403 },
      );
    }

    console.error("GET staff time off error:", error);

    return NextResponse.json(
      {
        message: "Failed to load time off",
      },
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
        {
          message: "Business setup is required",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    const staffId = Number(body.staffId);

    const startAt = body.startAt;

    const endAt = body.endAt;

    const reason = body.reason?.trim() || null;

    if (!staffId || !startAt || !endAt) {
      return NextResponse.json(
        {
          message: "Staff member, start time and end time are required",
        },
        { status: 400 },
      );
    }

    const startDate = new Date(startAt);

    const endDate = new Date(endAt);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      return NextResponse.json(
        {
          message: "Invalid time off period",
        },
        { status: 400 },
      );
    }

    const [staffRows]: any = await pool.query(
      `
        SELECT id
        FROM staff
        WHERE id = ?
          AND business_id = ?
          AND is_active = TRUE
        LIMIT 1
        `,
      [staffId, auth.businessId],
    );

    if (staffRows.length === 0) {
      return NextResponse.json(
        {
          message: "Team member not found",
        },
        { status: 404 },
      );
    }

    // Prevent overlapping blocked periods
    const [conflictingRows]: any = await pool.query(
      `
        SELECT id
        FROM staff_time_off
        WHERE staff_id = ?
          AND start_at < ?
          AND end_at > ?
        LIMIT 1
        `,
      [staffId, endAt, startAt],
    );

    if (conflictingRows.length > 0) {
      return NextResponse.json(
        {
          message: "This time off period overlaps an existing blocked period",
        },
        { status: 409 },
      );
    }

    const [result]: any = await pool.execute(
      `
        INSERT INTO staff_time_off (
          staff_id,
          start_at,
          end_at,
          reason
        )
        VALUES (?, ?, ?, ?)
        `,
      [staffId, startAt, endAt, reason],
    );

    return NextResponse.json(
      {
        message: "Time off added successfully",
        timeOffId: result.insertId,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        {
          message: "This account is inactive",
        },
        { status: 403 },
      );
    }

    if (error.message === "STAFF_ACCOUNT_NOT_LINKED") {
      return NextResponse.json(
        {
          message: "Staff account is not linked correctly",
        },
        { status: 403 },
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          message: "Owner access required",
        },
        { status: 403 },
      );
    }

    console.error("POST staff time off error:", error);

    return NextResponse.json(
      {
        message: "Failed to add time off",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);
    requireOwner(auth);

    if (auth.businessId == null) {
      return NextResponse.json(
        {
          message: "Business setup is required",
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);

    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json(
        {
          message: "Time off ID is required",
        },
        { status: 400 },
      );
    }

    const [rows]: any = await pool.query(
      `
        SELECT
          sto.id,
          sto.staff_id
        FROM staff_time_off sto

        JOIN staff s
          ON s.id = sto.staff_id

        WHERE sto.id = ?
          AND s.business_id = ?

        LIMIT 1
        `,
      [id, auth.businessId],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          message: "Time off not found",
        },
        { status: 404 },
      );
    }

    await pool.execute(
      `
      DELETE FROM staff_time_off
      WHERE id = ?
      `,
      [id],
    );

    return NextResponse.json({
      message: "Time off removed successfully",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        {
          message: "This account is inactive",
        },
        { status: 403 },
      );
    }

    if (error.message === "STAFF_ACCOUNT_NOT_LINKED") {
      return NextResponse.json(
        {
          message: "Staff account is not linked correctly",
        },
        { status: 403 },
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        {
          message: "Owner access required",
        },
        { status: 403 },
      );
    }

    console.error("DELETE staff time off error:", error);

    return NextResponse.json(
      {
        message: "Failed to remove time off",
      },
      { status: 500 },
    );
  }
}
