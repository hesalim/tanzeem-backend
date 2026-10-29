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
        user_id,
        first_name,
        last_name,
        phone,
        email,
        is_owner,
        is_active,
        created_at,
        updated_at
      FROM staff
      WHERE business_id = ?
        AND is_active = TRUE
      ORDER BY is_owner DESC, first_name
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

    console.error("GET staff error:", error);

    return NextResponse.json(
      { message: "Failed to load staff" },
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

    const { firstName, lastName, phone, email } = body;

    const normalizedEmail = email?.trim().toLowerCase();

    if (!firstName || firstName.trim().length === 0) {
      return NextResponse.json(
        { message: "First name is required" },
        { status: 400 },
      );
    }

    if (!normalizedEmail) {
      return NextResponse.json(
        { message: "Email is required for staff login" },
        { status: 400 },
      );
    }

    if (normalizedEmail && !normalizedEmail.endsWith("@tanzeem.com")) {
      return NextResponse.json(
        { message: "Email must use @tanzeem.com" },
        { status: 400 },
      );
    }

    const [result]: any = await pool.query(
      `
      INSERT INTO staff (
        business_id,
        user_id,
        first_name,
        last_name,
        phone,
        email,
        is_owner,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        auth.businessId,
        null,
        firstName.trim(),
        lastName?.trim() || null,
        phone?.trim() || null,
        normalizedEmail,
        false,
        true,
      ],
    );

    return NextResponse.json(
      {
        message: "Staff member created successfully",
        staffId: result.insertId,
      },
      {
        status: 201,
      },
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

    console.error("POST staff error:", error);

    return NextResponse.json(
      {
        message: "Failed to create staff member",
      },
      {
        status: 500,
      },
    );
  }
}
