import { NextResponse } from "next/server";

import pool from "../../../lib/db";
import {
  getAuthUser,
  requireOwner,
  requireActiveUser,
} from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);

    if (auth.businessId == null) {
      return NextResponse.json(
        { message: "Business not found" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);

    const requestedStaffId = Number(searchParams.get("staffId"));

    if (!requestedStaffId) {
      return NextResponse.json(
        { message: "Staff ID is required" },
        { status: 400 },
      );
    }

    let targetStaffId = requestedStaffId;

    // STAFF may only read their own assigned services
    if (auth.role === "STAFF") {
      if (auth.staffId == null) {
        return NextResponse.json(
          { message: "Staff account is required" },
          { status: 403 },
        );
      }

      if (requestedStaffId !== auth.staffId) {
        return NextResponse.json(
          {
            message: "You can only view your own assigned services",
          },
          { status: 403 },
        );
      }

      targetStaffId = auth.staffId;
    } else if (auth.role !== "OWNER") {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    const [staffRows]: any = await pool.query(
      `
      SELECT
        id,
        is_owner
      FROM staff
      WHERE id = ?
        AND business_id = ?
        AND is_active = 1
      LIMIT 1
      `,
      [targetStaffId, auth.businessId],
    );

    if (staffRows.length === 0) {
      return NextResponse.json(
        { message: "Team member not found" },
        { status: 404 },
      );
    }

    const [rows]: any = await pool.query(
      `
      SELECT
        s.id,
        s.name,
        s.duration_minutes,
        s.price,
        s.booking_type,
        s.max_participants,
        s.description

      FROM staff_services ss

      INNER JOIN services s
        ON s.id = ss.service_id

      WHERE ss.staff_id = ?
        AND s.business_id = ?
        AND s.is_active = 1

      ORDER BY s.name
      `,
      [targetStaffId, auth.businessId],
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

    console.error("GET STAFF SERVICES ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to load staff services",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let connection;

  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);

    requireOwner(auth);

    if (auth.businessId == null) {
      return NextResponse.json(
        { message: "Business not found" },
        { status: 400 },
      );
    }

    const body = await request.json();

    const staffId = Number(body.staffId);

    if (!staffId) {
      return NextResponse.json(
        { message: "Staff ID is required" },
        { status: 400 },
      );
    }

    const serviceIds: number[] = Array.isArray(body.serviceIds)
      ? body.serviceIds.map(Number)
      : [];

    if (
      serviceIds.some(
        (serviceId) => !Number.isInteger(serviceId) || serviceId <= 0,
      )
    ) {
      return NextResponse.json(
        {
          message: "One or more selected services are invalid",
        },
        { status: 400 },
      );
    }

    const uniqueServiceIds = [...new Set(serviceIds)];

    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [staffRows]: any = await connection.query(
      `
        SELECT
          id,
          is_owner
        FROM staff
        WHERE id = ?
          AND business_id = ?
          AND is_active = 1
        LIMIT 1
        `,
      [staffId, auth.businessId],
    );

    if (staffRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "Team member not found",
        },
        { status: 404 },
      );
    }

    if (uniqueServiceIds.length > 0) {
      const placeholders = uniqueServiceIds.map(() => "?").join(",");

      const [serviceRows]: any = await connection.query(
        `
          SELECT id
          FROM services
          WHERE id IN (${placeholders})
            AND business_id = ?
            AND is_active = 1
          `,
        [...uniqueServiceIds, auth.businessId],
      );

      if (serviceRows.length !== uniqueServiceIds.length) {
        await connection.rollback();

        return NextResponse.json(
          {
            message: "One or more selected services are invalid",
          },
          { status: 400 },
        );
      }
    }

    await connection.query(
      `
      DELETE FROM staff_services
      WHERE staff_id = ?
      `,
      [staffId],
    );

    for (const serviceId of uniqueServiceIds) {
      await connection.query(
        `
        INSERT INTO staff_services (
          staff_id,
          service_id
        )
        VALUES (?, ?)
        `,
        [staffId, serviceId],
      );
    }

    await connection.commit();

    return NextResponse.json({
      message: "Staff services updated successfully",
      staffId,
      serviceIds: uniqueServiceIds,
    });
  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

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

    console.error("UPDATE STAFF SERVICES ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to update staff services",
      },
      { status: 500 },
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
