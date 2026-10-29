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

    let appointmentDateCondition = "";
    let expenseDateCondition = "";

    switch (period) {
      case "today":
        appointmentDateCondition = `
          AND DATE(start_at) = CURDATE()
        `;

        expenseDateCondition = `
          AND expense_date = CURDATE()
        `;
        break;

      case "week":
        appointmentDateCondition = `
          AND YEARWEEK(start_at, 1) = YEARWEEK(CURDATE(), 1)
        `;

        expenseDateCondition = `
          AND YEARWEEK(expense_date, 1) = YEARWEEK(CURDATE(), 1)
        `;
        break;

      case "month":
        appointmentDateCondition = `
          AND YEAR(start_at) = YEAR(CURDATE())
          AND MONTH(start_at) = MONTH(CURDATE())
        `;

        expenseDateCondition = `
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

    const [revenueRows]: any = await pool.query(
      `
      SELECT
        COALESCE(SUM(total_price), 0) AS revenue,
        COUNT(*) AS completedAppointments
      FROM appointments
      WHERE business_id = ?
        AND status = 'COMPLETED'
        ${appointmentDateCondition}
      `,
      [businessId],
    );

    const [expenseRows]: any = await pool.query(
      `
      SELECT
        COALESCE(SUM(amount), 0) AS expenses
      FROM expenses
      WHERE business_id = ?
        AND is_active = TRUE
        ${expenseDateCondition}
      `,
      [businessId],
    );

    const revenue = Number(revenueRows[0].revenue);
    const expenses = Number(expenseRows[0].expenses);

    const profit = revenue - expenses;

    const completedAppointments = Number(revenueRows[0].completedAppointments);

    return NextResponse.json({
      period,
      revenue,
      expenses,
      profit,
      completedAppointments,
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

    console.error("GET finances error:", error);

    return NextResponse.json(
      { message: "Failed to load finances" },
      { status: 500 },
    );
  }
}
