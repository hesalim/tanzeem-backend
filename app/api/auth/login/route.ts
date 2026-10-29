import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import pool from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        {
          message: "Email and password are required",
        },
        {
          status: 400,
        },
      );
    }

    const [users]: any = await pool.query(
      `
      SELECT
        id,
        business_id,
        first_name,
        last_name,
        email,
        phone,
        password_hash,
        role,
        is_active
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email.trim()],
    );

    if (users.length === 0) {
      return NextResponse.json(
        {
          message: "Invalid email or password",
        },
        {
          status: 401,
        },
      );
    }

    const user = users[0];

    if (!user.is_active) {
      return NextResponse.json(
        {
          message: "This account is inactive",
        },
        {
          status: 403,
        },
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return NextResponse.json(
        {
          message: "Invalid email or password",
        },
        {
          status: 401,
        },
      );
    }

    let staffId = null;

    if (user.business_id != null) {
      const [staffRows]: any = await pool.query(
        `
        SELECT id
        FROM staff
        WHERE user_id = ?
          AND business_id = ?
          AND is_active = TRUE
        LIMIT 1
        `,
        [user.id, user.business_id],
      );

      if (staffRows.length > 0) {
        staffId = staffRows[0].id;
      }
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        businessId: user.business_id,
        staffId,
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: "7d",
      },
    );

    return NextResponse.json({
      message: "Login successful",

      token,

      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        businessId: user.business_id,
        staffId,
      },

      needsBusinessSetup: user.business_id == null,
    });
  } catch (error) {
    console.error("LOGIN error:", error);

    return NextResponse.json(
      {
        message: "Failed to log in",
      },
      {
        status: 500,
      },
    );
  }
}
