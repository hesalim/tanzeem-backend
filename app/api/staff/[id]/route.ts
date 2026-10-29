import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser, requireActiveUser, requireOwner } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

    const body = await request.json();

    const { firstName, lastName, phone, email } = body;

    if (!firstName || firstName.trim().isEmpty) {
      return NextResponse.json(
        { message: "First name is required" },
        { status: 400 },
      );
    }

    await connection.beginTransaction();

    const [staffRows]: any = await connection.query(
      `
      SELECT
        id,
        user_id,
        is_owner
      FROM staff
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [id, auth.businessId],
    );

    if (staffRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { message: "Staff member not found" },
        { status: 404 },
      );
    }

    const staff = staffRows[0];

    const cleanEmail = email?.trim().toLowerCase() || null;

    if (staff.user_id != null && cleanEmail != null) {
      const [existingUsers]: any = await connection.query(
        `
          SELECT id
          FROM users
          WHERE email = ?
            AND id <> ?
          LIMIT 1
          `,
        [cleanEmail, staff.user_id],
      );

      if (existingUsers.length > 0) {
        await connection.rollback();

        return NextResponse.json(
          {
            message: "Email is already in use",
          },
          {
            status: 409,
          },
        );
      }
    }

    await connection.query(
      `
      UPDATE staff
      SET
        first_name = ?,
        last_name = ?,
        phone = ?,
        email = ?,
        updated_at = NOW()
      WHERE id = ?
        AND business_id = ?
      `,
      [
        firstName.trim(),
        lastName?.trim() || null,
        phone?.trim() || null,
        cleanEmail,
        id,
        auth.businessId,
      ],
    );

    if (staff.user_id != null) {
      await connection.query(
        `
        UPDATE users
        SET
          first_name = ?,
          last_name = ?,
          phone = ?,
          email = ?,
          updated_at = NOW()
        WHERE id = ?
          AND business_id = ?
        `,
        [
          firstName.trim(),
          lastName?.trim() || null,
          phone?.trim() || null,
          cleanEmail,
          staff.user_id,
          auth.businessId,
        ],
      );
    }

    await connection.commit();

    return NextResponse.json({
      message: "Staff member updated successfully",
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
        {
          status: 403,
        },
      );
    }

    console.error("PUT staff error:", error);

    return NextResponse.json(
      {
        message: "Failed to update staff member",
      },
      {
        status: 500,
      },
    );
  } finally {
    connection.release();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

    await connection.beginTransaction();

    const [staffRows]: any = await connection.query(
      `
      SELECT
        id,
        user_id,
        is_owner
      FROM staff
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [id, auth.businessId],
    );

    if (staffRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { message: "Staff member not found" },
        { status: 404 },
      );
    }

    const staff = staffRows[0];

    if (staff.is_owner) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "The business owner cannot be deactivated",
        },
        {
          status: 400,
        },
      );
    }

    await connection.query(
      `
      UPDATE staff
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = ?
        AND business_id = ?
      `,
      [id, auth.businessId],
    );

    if (staff.user_id != null) {
      await connection.query(
        `
        UPDATE users
        SET
          is_active = FALSE,
          updated_at = NOW()
        WHERE id = ?
          AND business_id = ?
        `,
        [staff.user_id, auth.businessId],
      );
    }

    await connection.commit();

    return NextResponse.json({
      message: "Staff member deactivated successfully",
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
        {
          status: 403,
        },
      );
    }

    console.error("PATCH staff error:", error);

    return NextResponse.json(
      {
        message: "Failed to deactivate staff member",
      },
      {
        status: 500,
      },
    );
  } finally {
    connection.release();
  }
}
