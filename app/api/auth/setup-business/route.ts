import { NextResponse } from "next/server";
import pool from "@/lib/db";
import jwt from "jsonwebtoken";

import { getAuthUser, requireActiveUser, requireOwner } from "@/lib/auth";

export async function POST(request: Request) {
  const connection = await pool.getConnection();

  try {
    const auth = getAuthUser(request);

    await requireActiveUser(auth);
    requireOwner(auth);

    if (auth.businessId != null) {
      return NextResponse.json(
        {
          message: "This user already belongs to a business",
        },
        {
          status: 409,
        },
      );
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_SECRET_NOT_CONFIGURED");
    }

    const userId = auth.userId;

    const body = await request.json();

    const { businessName, businessType, phone, email, address, description } =
      body;

    if (!businessName || businessName.trim().isEmpty) {
      return NextResponse.json(
        {
          message: "Business name is required",
        },
        {
          status: 400,
        },
      );
    }

    await connection.beginTransaction();

    // Make sure the user still exists,
    // is active, and still has no business.
    const [userRows]: any = await connection.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        phone,
        email,
        business_id,
        role
      FROM users
      WHERE id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [userId],
    );

    if (userRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "User not found",
        },
        {
          status: 404,
        },
      );
    }

    const user = userRows[0];

    if (user.role !== "OWNER") {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "Owner access required",
        },
        {
          status: 403,
        },
      );
    }

    if (user.business_id != null) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "This user already belongs to a business",
        },
        {
          status: 409,
        },
      );
    }

    // Create business
    const [businessResult]: any = await connection.query(
      `
        INSERT INTO businesses (
          name,
          phone,
          email,
          address,
          description,
          business_type,
          is_team_business,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        businessName.trim(),
        phone?.trim() || null,
        email?.trim().toLowerCase() || null,
        address?.trim() || null,
        description?.trim() || null,
        businessType?.trim() || null,
        false,
        true,
      ],
    );

    const businessId = businessResult.insertId;

    // Link owner user to business
    await connection.query(
      `
      UPDATE users
      SET
        business_id = ?,
        updated_at = NOW()
      WHERE id = ?
        AND is_active = TRUE
      `,
      [businessId, userId],
    );

    // Create owner's staff record
    const [staffResult]: any = await connection.query(
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
        businessId,
        userId,
        user.first_name,
        user.last_name,
        user.phone,
        user.email,
        true,
        true,
      ],
    );

    const staffId = staffResult.insertId;

    const token = jwt.sign(
      {
        userId,
        businessId,
        staffId,
        role: "OWNER",
      },
      jwtSecret,
      {
        expiresIn: "7d",
      },
    );

    await connection.commit();

    return NextResponse.json(
      {
        message: "Business setup completed successfully",
        businessId,
        staffId,
        token,
      },
      {
        status: 201,
      },
    );
  } catch (error: any) {
    try {
      await connection.rollback();
    } catch {}

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

    if (error.message === "STAFF_ACCOUNT_NOT_LINKED") {
      return NextResponse.json(
        {
          message: "Staff account is not linked correctly",
        },
        {
          status: 403,
        },
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

    if (error.message === "JWT_SECRET_NOT_CONFIGURED") {
      console.error("JWT secret is not configured");

      return NextResponse.json(
        {
          message: "Server configuration error",
        },
        {
          status: 500,
        },
      );
    }

    console.error("SETUP BUSINESS error:", error);

    return NextResponse.json(
      {
        message: "Failed to set up business",
      },
      {
        status: 500,
      },
    );
  } finally {
    connection.release();
  }
}
