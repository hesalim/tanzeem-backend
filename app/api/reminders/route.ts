import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any = await connection.query(
      `
      SELECT
        ar.id AS reminder_id,
        ar.appointment_id,
        ar.business_id,
        ar.scheduled_at,

        a.start_at,

        c.first_name AS customer_first_name,
        c.last_name AS customer_last_name,
        c.phone AS customer_phone,

        b.name AS business_name

      FROM appointment_reminders ar

      INNER JOIN appointments a
        ON a.id = ar.appointment_id

      INNER JOIN customers c
        ON c.id = a.customer_id

      INNER JOIN businesses b
        ON b.id = ar.business_id

      WHERE ar.status = 'PENDING'
        AND ar.scheduled_at <= NOW()
        AND a.status <> 'CANCELLED'

      ORDER BY ar.scheduled_at ASC

      LIMIT 20
      `,
    );

    for (const reminder of rows) {
      try {
        await connection.execute(
          `
          UPDATE appointment_reminders
          SET
            status = 'SENDING',
            attempt_count = attempt_count + 1
          WHERE id = ?
            AND status = 'PENDING'
          `,
          [reminder.reminder_id],
        );

        // TEMPORARY FAKE WHATSAPP SENDER
        console.log("==================================");
        console.log("WHATSAPP REMINDER");
        console.log("Reminder ID:", reminder.reminder_id);
        console.log("Customer:", reminder.customer_first_name);
        console.log("Phone:", reminder.customer_phone);
        console.log("Business:", reminder.business_name);
        console.log("Appointment:", reminder.start_at);
        console.log("==================================");

        await connection.execute(
          `
          UPDATE appointment_reminders
          SET
            status = 'SENT',
            sent_at = NOW(),
            last_error = NULL
          WHERE id = ?
          `,
          [reminder.reminder_id],
        );
      } catch (error: any) {
        console.error("REMINDER SEND ERROR:", reminder.reminder_id, error);

        await connection.execute(
          `
          UPDATE appointment_reminders
          SET
            status = 'FAILED',
            last_error = ?
          WHERE id = ?
          `,
          [error.message ?? "Unknown reminder error", reminder.reminder_id],
        );
      }
    }

    await connection.commit();

    return NextResponse.json({
      message: "Reminder processing completed",
      processed: rows.length,
    });
  } catch (error: any) {
    try {
      await connection.rollback();
    } catch {}

    console.error("PROCESS REMINDERS ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to process reminders",
      },
      {
        status: 500,
      },
    );
  } finally {
    connection.release();
  }
}
