import { NextResponse } from "next/server";

import pool from "@/lib/db";
import { getAuthUser, requireActiveUser } from "@/lib/auth";

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
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

    const { id } = await context.params;

    const body = await request.json();

    const { first_name, last_name, phone, email, notes } = body;

    if (
      !first_name ||
      first_name.trim().isEmpty ||
      !phone ||
      phone.trim().isEmpty
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

    const cleanEmail = email?.trim().toLowerCase() || null;

    const [result]: any = await pool.query(
      `
      UPDATE customers
      SET
        first_name = ?,
        last_name = ?,
        phone = ?,
        email = ?,
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      `,
      [
        first_name.trim(),
        last_name?.trim() || null,
        phone.trim(),
        cleanEmail,
        notes?.trim() || null,
        id,
        auth.businessId,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          message: "Customer not found",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      message: "Customer updated successfully",
    });
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

    console.error("PUT customer error:", error);

    return NextResponse.json(
      {
        message: "Failed to update customer",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
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

    const { id } = await context.params;

    const [result]: any = await pool.query(
      `
      UPDATE customers
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      `,
      [id, auth.businessId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        {
          message: "Customer not found",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      message: "Customer deleted successfully",
    });
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

    console.error("PATCH customer error:", error);

    return NextResponse.json(
      {
        message: "Failed to delete customer",
      },
      {
        status: 500,
      },
    );
  }
}
