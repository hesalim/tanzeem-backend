import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import jwt from "jsonwebtoken";
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { firstName, lastName, email, phone, password } = body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!firstName || !normalizedEmail || !password) {
      return NextResponse.json(
        {
          message: "First name, email and password are required",
        },
        {
          status: 400,
        },
      );
    }
    if (!normalizedEmail.endsWith("@tanzeem.com")) {
      return NextResponse.json(
        {
          message: "Email must use @tanzeem.com",
        },
        {
          status: 400,
        },
      );
    }

    const [existingUsers]: any = await pool.query(
      `
        SELECT id
        FROM users
        WHERE email = ?
        LIMIT 1
        `,
      [normalizedEmail],
    );

    if (existingUsers.length > 0) {
      return NextResponse.json(
        {
          message: "An account with this email already exists",
        },
        {
          status: 409,
        },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result]: any = await pool.query(
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        null,
        firstName.trim(),
        lastName?.trim() || null,
        normalizedEmail,
        phone?.trim() || null,
        passwordHash,
        "OWNER",
        true,
      ],
    );

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const token = jwt.sign(
      {
        userId: result.insertId,
        businessId: null,
        staffId: null,
        role: "OWNER",
      },
      jwtSecret,
      {
        expiresIn: "7d",
      },
    );

    return NextResponse.json(
      {
        message: "Account created successfully",
        userId: result.insertId,
        token: token,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("SIGNUP error:", error);

    return NextResponse.json(
      {
        message: "Failed to create account",
      },
      {
        status: 500,
      },
    );
  }
}
