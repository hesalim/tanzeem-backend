import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import pool from "@/lib/db";
import { getAuthUser, requireActiveUser, requireOwner } from "@/lib/auth";

export async function POST(request: Request) {
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
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (email && !email.endsWith("@tanzeem.com")) {
      return NextResponse.json(
        {
          message: "Email must use @tanzeem.com",
        },
        { status: 400 },
      );
    }

    if (!staffId || !email || !password) {
      return NextResponse.json(
        {
          message: "Staff, email and password are required",
        },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          message: "Password must be at least 8 characters",
        },
        { status: 400 },
      );
    }

    await connection.beginTransaction();

    const [staffRows]: any = await connection.query(
      `
      SELECT
        id,
        user_id,
        first_name,
        last_name,
        phone,
        email
      FROM staff
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [staffId, auth.businessId],
    );

    if (staffRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { message: "Team member not found" },
        { status: 404 },
      );
    }

    const staff = staffRows[0];

    if (staff.user_id != null) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "This team member already has an account",
        },
        { status: 409 },
      );
    }

    const [existingUsers]: any = await connection.query(
      `
      SELECT id
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email],
    );

    if (existingUsers.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "Email is already in use",
        },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [userResult]: any = await connection.query(
      `
        INSERT INTO users (
          business_id,
          first_name,
          last_name,
          email,
          phone,
          password_hash,
          role,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, 'STAFF', TRUE)
        `,
      [
        auth.businessId,
        staff.first_name,
        staff.last_name,
        email,
        staff.phone,
        passwordHash,
      ],
    );

    const userId = userResult.insertId;

    await connection.query(
      `
      UPDATE staff
      SET
        user_id = ?,
        email = ?,
        updated_at = NOW()
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      `,
      [userId, email, staffId, auth.businessId],
    );

    await connection.commit();

    return NextResponse.json(
      {
        message: "Staff account created successfully",
        userId,
        staffId,
      },
      { status: 201 },
    );
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
        {
          message: "Owner access required",
        },
        { status: 403 },
      );
    }

    console.error("CREATE STAFF ACCOUNT ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to create staff account",
      },
      { status: 500 },
    );
  } finally {
    connection.release();
  }
}
