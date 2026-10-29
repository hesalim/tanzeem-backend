import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser, requireActiveUser, requireOwner } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const { id } = await params;

    const body = await request.json();

    const { title, amount, category, expenseDate, notes } = body;

    if (!title || amount === undefined || amount === null || !expenseDate) {
      return NextResponse.json(
        {
          message: "Title, amount and expense date are required",
        },
        {
          status: 400,
        },
      );
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return NextResponse.json(
        {
          message: "Amount must be a valid positive number",
        },
        {
          status: 400,
        },
      );
    }

    const [result]: any = await pool.query(
      `
      UPDATE expenses
      SET
        title = ?,
        amount = ?,
        category = ?,
        expense_date = ?,
        notes = ?,
        updated_at = NOW()
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      `,
      [
        title.trim(),
        numericAmount,
        category?.trim() || null,
        expenseDate,
        notes?.trim() || null,
        id,
        businessId,
      ],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Expense not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Expense updated successfully",
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
        {
          message: "Staff account is not linked correctly",
        },
        { status: 403 },
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { message: "Owner access required" },
        { status: 403 },
      );
    }

    console.error("PUT expense error:", error);

    return NextResponse.json(
      {
        message: "Failed to update expense",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const { id } = await params;

    const [result]: any = await pool.query(
      `
      UPDATE expenses
      SET
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      `,
      [id, businessId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Expense not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Expense deleted successfully",
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
        {
          message: "Staff account is not linked correctly",
        },
        { status: 403 },
      );
    }

    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { message: "Owner access required" },
        { status: 403 },
      );
    }

    console.error("PATCH expense error:", error);

    return NextResponse.json(
      {
        message: "Failed to delete expense",
      },
      {
        status: 500,
      },
    );
  }
}
