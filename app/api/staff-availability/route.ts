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

    // STAFF can only read their own availability
    if (auth.role === "STAFF") {
      if (auth.staffId == null) {
        return NextResponse.json(
          { message: "Staff account is not linked correctly" },
          { status: 403 },
        );
      }

      staffId = auth.staffId;
    } else if (auth.role === "OWNER") {
      if (!staffId) {
        return NextResponse.json(
          { message: "Staff ID is required" },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
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
        { message: "Team member not found" },
        { status: 404 },
      );
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        staff_id,
        day_of_week,
        is_working,
        start_time,
        end_time
      FROM staff_availability
      WHERE staff_id = ?
      ORDER BY day_of_week
      `,
      [staffId],
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
        { message: "Staff account is not linked correctly" },
        { status: 403 },
      );
    }

    console.error("GET staff availability error:", error);

    return NextResponse.json(
      { message: "Failed to load staff availability" },
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

    const staffId = Number(body.staffId);
    const availability = body.availability;

    if (!staffId) {
      return NextResponse.json(
        { message: "Staff ID is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(availability)) {
      return NextResponse.json(
        { message: "Availability must be a list" },
        { status: 400 },
      );
    }

    const [staffRows]: any = await connection.query(
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
        { message: "Team member not found" },
        { status: 404 },
      );
    }

    for (const day of availability) {
      const dayOfWeek = Number(day.dayOfWeek);
      const isWorking = Boolean(day.isWorking);

      if (dayOfWeek < 1 || dayOfWeek > 7) {
        return NextResponse.json(
          { message: "Invalid day of week" },
          { status: 400 },
        );
      }

      if (!isWorking) {
        continue;
      }

      // Temporary backward compatibility with the current Flutter screen.
      const periods = Array.isArray(day.periods)
        ? day.periods
        : day.startTime && day.endTime
          ? [
              {
                startTime: day.startTime,
                endTime: day.endTime,
              },
            ]
          : [];

      if (periods.length === 0) {
        return NextResponse.json(
          {
            message: "At least one working period is required for working days",
          },
          { status: 400 },
        );
      }

      const sortedPeriods = [...periods].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );

      for (let i = 0; i < sortedPeriods.length; i++) {
        const period = sortedPeriods[i];

        if (!period.startTime || !period.endTime) {
          return NextResponse.json(
            {
              message: "Start time and end time are required",
            },
            { status: 400 },
          );
        }

        if (period.startTime >= period.endTime) {
          return NextResponse.json(
            {
              message: "End time must be after start time",
            },
            { status: 400 },
          );
        }

        if (i > 0) {
          const previous = sortedPeriods[i - 1];

          if (period.startTime < previous.endTime) {
            return NextResponse.json(
              {
                message: "Working periods cannot overlap",
              },
              { status: 400 },
            );
          }
        }
      }
    }

    await connection.beginTransaction();

    // Replace this staff member's whole weekly schedule.
    await connection.query(
      `
  DELETE FROM staff_availability
  WHERE staff_id = ?
  `,
      [staffId],
    );

    for (const day of availability) {
      const dayOfWeek = Number(day.dayOfWeek);
      const isWorking = Boolean(day.isWorking);

      if (!isWorking) {
        // Keep one row so we explicitly know the staff member
        // is not working on this day.
        await connection.query(
          `
      INSERT INTO staff_availability (
        staff_id,
        day_of_week,
        is_working,
        start_time,
        end_time
      )
      VALUES (?, ?, FALSE, NULL, NULL)
      `,
          [staffId, dayOfWeek],
        );

        continue;
      }

      // Supports the new multiple-period structure,
      // while still accepting the current Flutter structure.
      const periods = Array.isArray(day.periods)
        ? day.periods
        : [
            {
              startTime: day.startTime,
              endTime: day.endTime,
            },
          ];

      for (const period of periods) {
        await connection.query(
          `
      INSERT INTO staff_availability (
        staff_id,
        day_of_week,
        is_working,
        start_time,
        end_time
      )
      VALUES (?, ?, TRUE, ?, ?)
      `,
          [staffId, dayOfWeek, period.startTime, period.endTime],
        );
      }
    }

    await connection.commit();

    return NextResponse.json({
      message: "Availability updated successfully",
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

    console.error("PUT staff availability error:", error);

    return NextResponse.json(
      { message: "Failed to update staff availability" },
      { status: 500 },
    );
  } finally {
    connection.release();
  }
}
