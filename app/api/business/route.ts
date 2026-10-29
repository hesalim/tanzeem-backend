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

    const businessId = auth.businessId;

    const [rows]: any = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        address,
        description,
        business_type,
        is_team_business,
        is_active,
        created_at,
        updated_at
      FROM businesses
      WHERE id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [businessId],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Business not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(rows[0]);
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

    console.error("GET business error:", error);

    return NextResponse.json(
      { message: "Failed to load business" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
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

    const businessId = auth.businessId;

    const body = await request.json();

    const { name, phone, email, address, description, businessType } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { message: "Business name is required" },
        { status: 400 },
      );
    }

    const [result]: any = await pool.query(
      `
      UPDATE businesses
      SET
        name = ?,
        phone = ?,
        email = ?,
        address = ?,
        description = ?,
        business_type = ?,
        updated_at = NOW()
      WHERE id = ?
        AND is_active = TRUE
      `,
      [
        name.trim(),
        phone?.trim() || null,
        email?.trim().toLowerCase() || null,
        address?.trim() || null,
        description?.trim() || null,
        businessType?.trim() || null,
        businessId,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Business not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Business updated successfully",
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

    console.error("PUT business error:", error);

    return NextResponse.json(
      { message: "Failed to update business" },
      { status: 500 },
    );
  }
}
