import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import pool from "../../../lib/db";
import { getAuthUser, requireActiveUser } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);

    const [rows]: any = await pool.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone,
        role
      FROM users
      WHERE id = ?
        AND is_active = 1
      LIMIT 1
      `,
      [auth.userId],
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const user = rows[0];

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
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

    console.error("GET PROFILE ERROR:", error);

    return NextResponse.json(
      { message: "Failed to load profile" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const connection = await pool.getConnection();

  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);

    const body = await request.json();

    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim() || null;
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim() || null;

    if (!firstName) {
      return NextResponse.json(
        { message: "First name is required" },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 },
      );
    }

    const [existingUsers]: any = await connection.query(
      `
        SELECT id
        FROM users
        WHERE email = ?
          AND id <> ?
        LIMIT 1
        `,
      [email, auth.userId],
    );

    if (existingUsers.length > 0) {
      return NextResponse.json(
        {
          message: "Email is already in use",
        },
        { status: 409 },
      );
    }

    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE users
      SET
        first_name = ?,
        last_name = ?,
        email = ?,
        phone = ?,
        updated_at = NOW()
      WHERE id = ?
        AND is_active = 1
      `,
      [firstName, lastName, email, phone, auth.userId],
    );

    // Keep linked staff record synchronized
    if (auth.staffId != null) {
      await connection.query(
        `
        UPDATE staff
        SET
          first_name = ?,
          last_name = ?,
          email = ?,
          phone = ?,
          updated_at = NOW()
        WHERE id = ?
          AND user_id = ?
          AND is_active = 1
        `,
        [firstName, lastName, email, phone, auth.staffId, auth.userId],
      );
    }

    await connection.commit();

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        id: auth.userId,
        firstName,
        lastName,
        email,
        phone,
        role: auth.role,
      },
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

    console.error("UPDATE PROFILE ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to update profile",
      },
      { status: 500 },
    );
  } finally {
    connection.release();
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);

    const body = await request.json();

    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        {
          message: "Current password and new password are required",
        },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          message: "New password must be at least 8 characters",
        },
        { status: 400 },
      );
    }

    const [rows]: any = await pool.query(
      `
      SELECT password_hash
      FROM users
      WHERE id = ?
        AND is_active = 1
      LIMIT 1
      `,
      [auth.userId],
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      rows[0].password_hash,
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          message: "Current password is incorrect",
        },
        { status: 400 },
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE users
      SET
        password_hash = ?,
        updated_at = NOW()
      WHERE id = ?
        AND is_active = 1
      `,
      [newPasswordHash, auth.userId],
    );

    return NextResponse.json({
      message: "Password changed successfully",
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

    console.error("CHANGE PASSWORD ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to change password",
      },
      { status: 500 },
    );
  }
}
