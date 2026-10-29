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

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "month";

    let dateCondition = "";

    switch (period) {
      case "today":
        dateCondition = "AND expense_date = CURDATE()";
        break;

      case "week":
        dateCondition = `
          AND YEARWEEK(expense_date, 1) = YEARWEEK(CURDATE(), 1)
        `;
        break;

      case "month":
        dateCondition = `
          AND YEAR(expense_date) = YEAR(CURDATE())
          AND MONTH(expense_date) = MONTH(CURDATE())
        `;
        break;

      case "all":
        break;

      default:
        return NextResponse.json(
          { message: "Invalid period" },
          { status: 400 },
        );
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        business_id,
        title,
        amount,
        category,
        expense_date,
        notes,
        is_active,
        created_at,
        updated_at
      FROM expenses
      WHERE business_id = ?
        AND is_active = TRUE
        ${dateCondition}
      ORDER BY expense_date DESC, id DESC
      `,
      [businessId],
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

    console.error("GET expenses error:", error);

    return NextResponse.json(
      { message: "Failed to load expenses" },
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

    const businessId = auth.businessId;

    const body = await request.json();

    const { title, amount, category, expenseDate, notes } = body;

    if (!title || amount === undefined || amount === null || !expenseDate) {
      return NextResponse.json(
        {
          message: "Title, amount and expense date are required",
        },
        { status: 400 },
      );
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return NextResponse.json(
        {
          message: "Amount must be a valid positive number",
        },
        { status: 400 },
      );
    }

    const [result]: any = await pool.query(
      `
      INSERT INTO expenses (
        business_id,
        title,
        amount,
        category,
        expense_date,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        businessId,
        title.trim(),
        numericAmount,
        category?.trim() || null,
        expenseDate,
        notes?.trim() || null,
      ],
    );

    return NextResponse.json(
      {
        message: "Expense created successfully",
        expenseId: result.insertId,
      },
      { status: 201 },
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

    console.error("POST expense error:", error);

    return NextResponse.json(
      { message: "Failed to create expense" },
      { status: 500 },
    );
  }
}
