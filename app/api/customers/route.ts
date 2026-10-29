import { NextResponse } from "next/server";

import pool from "@/lib/db";
import { getAuthUser, requireActiveUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);

    if (auth.businessId == null) {
      return NextResponse.json(
        {
          message: "Business setup is required",
        },
        {
          status: 403,
        },
      );
    }

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() ?? "";
    const recent = searchParams.get("recent") === "true";

    // SEARCH MODE
    if (search.length > 0) {
      const searchValue = `%${search}%`;

      const [rows] = await pool.query(
        `
        SELECT
          id,
          business_id,
          first_name,
          last_name,
          phone,
          email,
          notes,
          is_active
        FROM customers
        WHERE business_id = ?
          AND is_active = TRUE
          AND (
            first_name LIKE ?
            OR last_name LIKE ?
            OR CONCAT_WS(' ', first_name, last_name) LIKE ?
            OR phone LIKE ?
          )
        ORDER BY first_name, last_name
        LIMIT 20
        `,
        [auth.businessId, searchValue, searchValue, searchValue, searchValue],
      );

      return NextResponse.json(rows);
    }

    // RECENT CUSTOMERS MODE
    if (recent) {
      const [rows] = await pool.query(
        `
        SELECT
          c.id,
          c.business_id,
          c.first_name,
          c.last_name,
          c.phone,
          c.email,
          c.notes,
          c.is_active
        FROM customers c

        LEFT JOIN (
          SELECT
            customer_id,
            MAX(start_at) AS last_appointment_at
          FROM appointments
          WHERE business_id = ?
          GROUP BY customer_id
        ) recent_appointments
          ON recent_appointments.customer_id = c.id

        WHERE c.business_id = ?
          AND c.is_active = TRUE

        ORDER BY
          recent_appointments.last_appointment_at IS NULL,
          recent_appointments.last_appointment_at DESC,
          c.id DESC

        LIMIT 10
        `,
        [auth.businessId, auth.businessId],
      );

      return NextResponse.json(rows);
    }

    // NORMAL CUSTOMERS SCREEN
    const [rows] = await pool.query(
      `
      SELECT
        id,
        business_id,
        first_name,
        last_name,
        phone,
        email,
        notes,
        is_active
      FROM customers
      WHERE business_id = ?
        AND is_active = TRUE
      ORDER BY first_name
      `,
      [auth.businessId],
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          message: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        {
          message: "This account is inactive",
        },
        {
          status: 403,
        },
      );
    }

    console.error("GET customers error:", error);

    return NextResponse.json(
      {
        message: "Failed to load customers",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);

    if (auth.businessId == null) {
      return NextResponse.json(
        {
          message: "Business setup is required",
        },
        {
          status: 403,
        },
      );
    }

    const body = await request.json();

    const { first_name, last_name, phone, email, notes } = body;

    if (
      !first_name ||
      first_name.trim().length === 0 ||
      !phone ||
      phone.trim().length === 0
    ) {
      return NextResponse.json(
        {
          message: "First name and phone number are required",
        },
        {
          status: 400,
        },
      );
    }

    const [result]: any = await pool.query(
      `
      INSERT INTO customers (
        business_id,
        first_name,
        last_name,
        phone,
        email,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        auth.businessId,
        first_name.trim(),
        last_name?.trim() || null,
        phone.trim(),
        email?.trim().toLowerCase() || null,
        notes?.trim() || null,
      ],
    );

    return NextResponse.json(
      {
        message: "Customer created successfully",
        customerId: result.insertId,
      },
      {
        status: 201,
      },
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          message: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        {
          message: "This account is inactive",
        },
        {
          status: 403,
        },
      );
    }

    console.error("POST customer error:", error);

    return NextResponse.json(
      {
        message: "Failed to create customer",
      },
      {
        status: 500,
      },
    );
  }
}
