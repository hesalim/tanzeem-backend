import { NextResponse } from "next/server";
import pool from "@/lib/db";

function timeToMinutes(value: string) {
  const parts = value.toString().split(":");

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  return hours * 60 + minutes;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const connection = await pool.getConnection();

  try {
    const { slug } = await params;

    const body = await request.json();

    const {
      firstName,
      lastName,
      phone,
      email,
      notes,
      staffId,
      serviceId,
      startAt,
    } = body;

    // --------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------

    if (
      !firstName ||
      firstName.trim().length === 0 ||
      !phone ||
      phone.trim().length === 0 ||
      !staffId ||
      !serviceId ||
      !startAt
    ) {
      return NextResponse.json(
        {
          message:
            "First name, phone, service, staff member and appointment time are required",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // FIND PUBLIC BUSINESS
    // --------------------------------------------------

    const [siteRows]: any = await connection.query(
      `
      SELECT
        bs.business_id
      FROM business_sites bs
      WHERE bs.slug = ?
        AND bs.is_published = TRUE
      LIMIT 1
      `,
      [slug],
    );

    if (siteRows.length === 0) {
      return NextResponse.json(
        {
          message: "Business website not found",
        },
        {
          status: 404,
        },
      );
    }

    const businessId = Number(siteRows[0].business_id);

    const targetStaffId = Number(staffId);
    const targetServiceId = Number(serviceId);

    // --------------------------------------------------
    // START TRANSACTION
    // --------------------------------------------------

    await connection.beginTransaction();

    // --------------------------------------------------
    // VALIDATE STAFF
    // --------------------------------------------------

    const [staffRows]: any = await connection.query(
      `
      SELECT
        id
      FROM staff
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [targetStaffId, businessId],
    );

    if (staffRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "Team member not found",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // VALIDATE SERVICE ASSIGNMENT
    // --------------------------------------------------

    const [serviceRows]: any = await connection.query(
      `
        SELECT
          s.id,
          s.price,
          s.duration_minutes
        FROM services s

        INNER JOIN staff_services ss
          ON ss.service_id = s.id

        WHERE s.id = ?
          AND s.business_id = ?
          AND s.is_active = TRUE
          AND ss.staff_id = ?

        LIMIT 1
        `,
      [targetServiceId, businessId, targetStaffId],
    );

    if (serviceRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "This service is not available for this team member",
        },
        {
          status: 400,
        },
      );
    }

    const service = serviceRows[0];

    const durationMinutes = Number(service.duration_minutes);

    const price = Number(service.price);

    // --------------------------------------------------
    // APPOINTMENT TIME
    //
    // Important:
    // We calculate endAt ourselves.
    // Customer cannot manipulate service duration.
    // --------------------------------------------------

    const startDate = new Date(startAt);

    if (Number.isNaN(startDate.getTime())) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "Invalid appointment time",
        },
        {
          status: 400,
        },
      );
    }

    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    const formattedStartAt = startAt;

    const year = endDate.getFullYear();
    const month = String(endDate.getMonth() + 1).padStart(2, "0");
    const day = String(endDate.getDate()).padStart(2, "0");
    const hours = String(endDate.getHours()).padStart(2, "0");
    const minutes = String(endDate.getMinutes()).padStart(2, "0");
    const seconds = String(endDate.getSeconds()).padStart(2, "0");

    const formattedEndAt =
      `${year}-${month}-${day} ` + `${hours}:${minutes}:${seconds}`;

    // --------------------------------------------------
    // SAME DAY CHECK
    // --------------------------------------------------

    if (
      startDate.getFullYear() !== endDate.getFullYear() ||
      startDate.getMonth() !== endDate.getMonth() ||
      startDate.getDate() !== endDate.getDate()
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "Appointments cannot continue into the next day",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // DAY OF WEEK
    // Monday = 1 ... Sunday = 7
    // --------------------------------------------------

    const appointmentDayOfWeek =
      startDate.getDay() === 0 ? 7 : startDate.getDay();

    const appointmentStartMinutes =
      startDate.getHours() * 60 + startDate.getMinutes();

    const appointmentEndMinutes =
      endDate.getHours() * 60 + endDate.getMinutes();

    // --------------------------------------------------
    // BUSINESS HOURS
    // --------------------------------------------------

    const [businessHoursRows]: any = await connection.query(
      `
        SELECT
          is_open,
          open_time,
          close_time
        FROM business_hours
        WHERE business_id = ?
          AND day_of_week = ?
        LIMIT 1
        `,
      [businessId, appointmentDayOfWeek],
    );

    if (businessHoursRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "Business hours have not been configured for this day",
        },
        {
          status: 409,
        },
      );
    }

    const businessHours = businessHoursRows[0];

    if (!businessHours.is_open) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "The business is closed on this day",
        },
        {
          status: 409,
        },
      );
    }

    if (businessHours.open_time == null || businessHours.close_time == null) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "Business hours are not configured correctly",
        },
        {
          status: 409,
        },
      );
    }

    const businessOpenMinutes = timeToMinutes(businessHours.open_time);

    const businessCloseMinutes = timeToMinutes(businessHours.close_time);

    if (
      appointmentStartMinutes < businessOpenMinutes ||
      appointmentEndMinutes > businessCloseMinutes
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "The selected time is outside business hours",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // STAFF AVAILABILITY
    //
    // Supports split shifts:
    //
    // 08:00 - 12:00
    // 14:00 - 18:00
    // --------------------------------------------------

    const [availabilityRows]: any = await connection.query(
      `
        SELECT
          is_working,
          start_time,
          end_time
        FROM staff_availability
        WHERE staff_id = ?
          AND day_of_week = ?
        ORDER BY start_time
        `,
      [targetStaffId, appointmentDayOfWeek],
    );

    if (availabilityRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message:
            "Working hours have not been configured for this team member",
        },
        {
          status: 409,
        },
      );
    }

    const workingPeriods = availabilityRows.filter(
      (row: any) =>
        row.is_working && row.start_time != null && row.end_time != null,
    );

    if (workingPeriods.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "This team member is not working on this day",
        },
        {
          status: 409,
        },
      );
    }

    const appointmentFitsWorkingPeriod = workingPeriods.some((period: any) => {
      const start = timeToMinutes(period.start_time);

      const end = timeToMinutes(period.end_time);

      return appointmentStartMinutes >= start && appointmentEndMinutes <= end;
    });

    if (!appointmentFitsWorkingPeriod) {
      await connection.rollback();

      return NextResponse.json(
        {
          message:
            "The selected time is outside this team member's working hours",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // TIME OFF
    // --------------------------------------------------

    const [timeOffRows]: any = await connection.query(
      `
        SELECT
          id,
          start_at,
          end_at,
          reason
        FROM staff_time_off
        WHERE staff_id = ?
          AND start_at < ?
          AND end_at > ?
        LIMIT 1
        `,
      [targetStaffId, formattedEndAt, formattedStartAt],
    );

    if (timeOffRows.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "This team member is unavailable during this time",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // DOUBLE BOOKING
    // --------------------------------------------------

    const [conflictingAppointments]: any = await connection.query(
      `
        SELECT
          id
        FROM appointments
        WHERE business_id = ?
          AND staff_id = ?
          AND status <> 'CANCELLED'
          AND start_at < ?
          AND end_at > ?
        LIMIT 1
        `,
      [businessId, targetStaffId, formattedEndAt, formattedStartAt],
    );

    if (conflictingAppointments.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message:
            "This time is no longer available. Please choose another time.",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // FIND CUSTOMER BY PHONE
    // --------------------------------------------------

    const cleanedPhone = phone.trim();

    const [customerRows]: any = await connection.query(
      `
        SELECT
          id
        FROM customers
        WHERE business_id = ?
          AND phone = ?
          AND is_active = TRUE
        LIMIT 1
        `,
      [businessId, cleanedPhone],
    );

    let customerId: number;

    if (customerRows.length > 0) {
      customerId = Number(customerRows[0].id);
    } else {
      // ------------------------------------------------
      // CREATE CUSTOMER
      // ------------------------------------------------

      const [customerResult]: any = await connection.query(
        `
          INSERT INTO customers (
            business_id,
            first_name,
            last_name,
            phone,
            email
          )
          VALUES (?, ?, ?, ?, ?)
          `,
        [
          businessId,
          firstName.trim(),
          lastName?.trim() || null,
          cleanedPhone,
          email?.trim().toLowerCase() || null,
        ],
      );

      customerId = Number(customerResult.insertId);
    }

    // --------------------------------------------------
    // CREATE APPOINTMENT
    //
    // created_by_user_id = NULL because this booking
    // came from the public website.
    // --------------------------------------------------

    const [appointmentResult]: any = await connection.execute(
      `
        INSERT INTO appointments (
          business_id,
          customer_id,
          staff_id,
          start_at,
          end_at,
          status,
          total_price,
          notes,
          created_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        businessId,
        customerId,
        targetStaffId,
        formattedStartAt,
        formattedEndAt,
        "CONFIRMED",
        price,
        notes?.trim() || null,
        null,
      ],
    );

    const appointmentId = Number(appointmentResult.insertId);

    // --------------------------------------------------
    // APPOINTMENT SERVICE
    // --------------------------------------------------

    await connection.execute(
      `
      INSERT INTO appointment_services (
        appointment_id,
        service_id,
        price,
        duration_minutes
      )
      VALUES (?, ?, ?, ?)
      `,
      [appointmentId, targetServiceId, price, durationMinutes],
    );

    // --------------------------------------------------
    // WHATSAPP REMINDER
    // 24 HOURS BEFORE
    // --------------------------------------------------

    const reminderScheduledAt = new Date(
      startDate.getTime() - 24 * 60 * 60 * 1000,
    );

    if (reminderScheduledAt > new Date()) {
      await connection.execute(
        `
        INSERT INTO appointment_reminders (
          appointment_id,
          business_id,
          channel,
          scheduled_at,
          status
        )
        VALUES (?, ?, 'WHATSAPP', ?, 'PENDING')
        `,
        [appointmentId, businessId, reminderScheduledAt],
      );
    }

    // --------------------------------------------------
    // COMMIT
    // --------------------------------------------------

    await connection.commit();

    return NextResponse.json(
      {
        message: "Appointment booked successfully",
        appointmentId,
        customerId,
        staffId: targetStaffId,
        serviceId: targetServiceId,
        startAt: formattedStartAt,
        endAt: formattedEndAt,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}

    console.error("PUBLIC BOOKING ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to create booking",
      },
      {
        status: 500,
      },
    );
  } finally {
    connection.release();
  }
}
