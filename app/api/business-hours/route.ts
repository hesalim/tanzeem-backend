import { NextResponse } from "next/server";
import pool from "@/lib/db";

import { getAuthUser, requireActiveUser, requireOwner } from "@/lib/auth";

export async function GET(request: Request) {
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

    const [rows] = await pool.query(
      `
      SELECT
        id,
        business_id,
        day_of_week,
        is_open,
        open_time,
        close_time
      FROM business_hours
      WHERE business_id = ?
      ORDER BY day_of_week
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
        { message: "Owner access required" },
        { status: 403 },
      );
    }

    console.error("GET business hours error:", error);

    return NextResponse.json(
      {
        message: "Failed to load business hours",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const connection = await pool.getConnection();

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

    const hours = body.hours;

    if (!Array.isArray(hours)) {
      return NextResponse.json(
        {
          message: "Business hours must be a list",
        },
        { status: 400 },
      );
    }

    const seenDays = new Set<number>();

    for (const day of hours) {
      const dayOfWeek = Number(day.dayOfWeek);

      const isOpen = Boolean(day.isOpen);

      if (dayOfWeek < 1 || dayOfWeek > 7) {
        return NextResponse.json(
          {
            message: "Invalid day of week",
          },
          { status: 400 },
        );
      }

      if (seenDays.has(dayOfWeek)) {
        return NextResponse.json(
          {
            message: "Duplicate day in business hours",
          },
          { status: 400 },
        );
      }

      seenDays.add(dayOfWeek);

      if (isOpen) {
        if (!day.openTime || !day.closeTime) {
          return NextResponse.json(
            {
              message: "Open time and close time are required for open days",
            },
            { status: 400 },
          );
        }

        if (day.openTime >= day.closeTime) {
          return NextResponse.json(
            {
              message: "Close time must be after open time",
            },
            { status: 400 },
          );
        }
      }
    }

    await connection.beginTransaction();

    for (const day of hours) {
      const dayOfWeek = Number(day.dayOfWeek);

      const isOpen = Boolean(day.isOpen);

      const openTime = isOpen ? day.openTime : null;

      const closeTime = isOpen ? day.closeTime : null;

      await connection.query(
        `
        INSERT INTO business_hours (
          business_id,
          day_of_week,
          is_open,
          open_time,
          close_time
        )
        VALUES (?, ?, ?, ?, ?)

        ON DUPLICATE KEY UPDATE
          is_open = VALUES(is_open),
          open_time = VALUES(open_time),
          close_time = VALUES(close_time),
          updated_at = NOW()
        `,
        [auth.businessId, dayOfWeek, isOpen, openTime, closeTime],
      );
    }

    await connection.commit();

    return NextResponse.json({
      message: "Business hours updated successfully",
    });
  } catch (error: any) {
    try {
      await connection.rollback();
    } catch {}

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
        {
          message: "Staff account is not linked correctly",
        },
        { status: 403 },
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { message: "Owner access required" },
        { status: 403 },
      );
    }

    console.error("PUT business hours error:", error);

    return NextResponse.json(
      {
        message: "Failed to update business hours",
      },
      { status: 500 },
    );
  } finally {
    connection.release();
  }
}
