import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser, requireActiveUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    await requireActiveUser(auth);
    if (auth.businessId == null) {
      return NextResponse.json(
        { message: "Business setup is required" },
        { status: 403 },
      );
    }

    const businessId = auth.businessId;

    let appointmentQuery = `
      SELECT
        a.id,
        a.business_id,
        a.customer_id,
        a.staff_id,
        a.start_at,
        a.end_at,
        a.status,
        a.total_price,
        a.notes,
        a.created_by_user_id,

        c.first_name AS customer_first_name,
        c.last_name AS customer_last_name,
        c.phone AS customer_phone,

        s.first_name AS staff_first_name,
        s.last_name AS staff_last_name

      FROM appointments a

      JOIN customers c
        ON c.id = a.customer_id

      JOIN staff s
        ON s.id = a.staff_id

      WHERE a.business_id = ?
    `;

    const params: any[] = [businessId];

    // STAFF only sees their own appointments
    if (auth.role === "STAFF") {
      if (auth.staffId == null) {
        return NextResponse.json(
          { message: "Staff account is required" },
          { status: 403 },
        );
      }

      appointmentQuery += `
        AND a.staff_id = ?
      `;

      params.push(auth.staffId);
    }

    appointmentQuery += `
      ORDER BY a.start_at
    `;

    const [appointmentRows] = await pool.query(appointmentQuery, params);

    const appointments = appointmentRows as any[];

    for (const appointment of appointments) {
      const [serviceRows] = await pool.query(
        `
        SELECT
          s.id,
          s.name,
          aps.price,
          aps.duration_minutes

        FROM appointment_services aps

        JOIN services s
          ON s.id = aps.service_id

        WHERE aps.appointment_id = ?

        ORDER BY s.name
        `,
        [appointment.id],
      );

      appointment.services = serviceRows;
    }

    return NextResponse.json(appointments);
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

    console.error("GET appointments error:", error);

    return NextResponse.json(
      {
        message: "Failed to load appointments",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();

  try {
    const auth = getAuthUser(request);
    await requireActiveUser(auth);
    if (auth.businessId == null) {
      return NextResponse.json(
        { message: "Business setup is required" },
        { status: 403 },
      );
    }

    const businessId = auth.businessId;
    const userId = auth.userId;

    const body = await request.json();

    const {
      customerId,
      staffId: requestedStaffId,
      startAt,
      endAt,
      notes,
      services,
    } = body;

    if (
      !customerId ||
      !startAt ||
      !endAt ||
      !services ||
      !Array.isArray(services) ||
      services.length === 0
    ) {
      return NextResponse.json(
        {
          message: "Missing required fields",
        },
        {
          status: 400,
        },
      );
    }

    let targetStaffId: number;

    // STAFF can only create appointments for themselves
    if (auth.role === "STAFF") {
      if (auth.staffId == null) {
        return NextResponse.json(
          { message: "Staff account is required" },
          { status: 403 },
        );
      }

      targetStaffId = auth.staffId;
    }

    // OWNER may choose any active staff member
    else if (auth.role === "OWNER") {
      if (!requestedStaffId) {
        return NextResponse.json(
          {
            message: "Team member is required",
          },
          {
            status: 400,
          },
        );
      }

      targetStaffId = Number(requestedStaffId);
    } else {
      return NextResponse.json(
        {
          message: "You cannot create appointments",
        },
        {
          status: 403,
        },
      );
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      return NextResponse.json(
        {
          message: "Invalid appointment time",
        },
        {
          status: 400,
        },
      );
    }
    if (
      startDate.getFullYear() !== endDate.getFullYear() ||
      startDate.getMonth() !== endDate.getMonth() ||
      startDate.getDate() !== endDate.getDate()
    ) {
      return NextResponse.json(
        {
          message: "Appointments cannot continue into the next day",
        },
        {
          status: 400,
        },
      );
    }

    await connection.beginTransaction();

    // Make sure target staff belongs to this business
    const [staffRows]: any = await connection.query(
      `
      SELECT
        id,
        is_owner
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

    const targetStaff = staffRows[0];

    // Extra security:
    // STAFF cannot send another staffId and impersonate them
    if (auth.role === "STAFF" && targetStaffId !== auth.staffId) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "You can only create appointments for yourself",
        },
        {
          status: 403,
        },
      );
    }

    // Make sure customer belongs to this business
    const [customerRows]: any = await connection.query(
      `
      SELECT id
      FROM customers
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [customerId, businessId],
    );

    if (customerRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: "Customer not found",
        },
        {
          status: 404,
        },
      );
    }

    const validatedServices: {
      serviceId: number;
      price: number;
      durationMinutes: number;
    }[] = [];

    let totalPrice = 0;

    for (const service of services) {
      const serviceId = Number(service.serviceId);

      if (!serviceId) {
        await connection.rollback();

        return NextResponse.json(
          {
            message: "Invalid service",
          },
          {
            status: 400,
          },
        );
      }

      let serviceRows: any;

      // Owner staff record can currently provide all
      // active business services.
      if (targetStaff.is_owner) {
        const [rows]: any = await connection.query(
          `
          SELECT
            id,
            price,
            duration_minutes
          FROM services
          WHERE id = ?
            AND business_id = ?
            AND is_active = TRUE
          LIMIT 1
          `,
          [serviceId, businessId],
        );

        serviceRows = rows;
      } else {
        // Normal staff can only use services
        // assigned to them in staff_services.
        const [rows]: any = await connection.query(
          `
          SELECT
            s.id,
            s.price,
            s.duration_minutes
          FROM services s

          JOIN staff_services ss
            ON ss.service_id = s.id

          WHERE s.id = ?
            AND s.business_id = ?
            AND s.is_active = TRUE
            AND ss.staff_id = ?

          LIMIT 1
          `,
          [serviceId, businessId, targetStaffId],
        );

        serviceRows = rows;
      }

      if (serviceRows.length === 0) {
        await connection.rollback();

        return NextResponse.json(
          {
            message:
              "One or more services are not assigned to this team member",
          },
          {
            status: 400,
          },
        );
      }

      const dbService = serviceRows[0];

      const price = Number(dbService.price);

      const durationMinutes = Number(dbService.duration_minutes);

      totalPrice += price;

      validatedServices.push({
        serviceId: dbService.id,
        price,
        durationMinutes,
      });
    }
    // SCHEDULE CHECKS
    //
    // Order:
    // 1. Business must be open
    // 2. Staff member must be working
    // 3. Appointment must fit inside both schedules
    // 4. Then check double booking

    const appointmentDayOfWeek =
      startDate.getDay() === 0 ? 7 : startDate.getDay();

    const timeToMinutes = (value: string) => {
      const parts = value.toString().split(":");

      const hours = Number(parts[0]);

      const minutes = Number(parts[1]);

      return hours * 60 + minutes;
    };

    const appointmentStartMinutes =
      startDate.getHours() * 60 + startDate.getMinutes();

    const appointmentEndMinutes =
      endDate.getHours() * 60 + endDate.getMinutes();

    // BUSINESS HOURS CHECK

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
          message: "Business hours are not configured correctly for this day",
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
          message: `The business is open from ${businessHours.open_time} to ${businessHours.close_time} on this day`,
        },
        {
          status: 409,
        },
      );
    }

    // STAFF AVAILABILITY CHECK

    const [availabilityRows]: any = await connection.query(
      `
    SELECT
      is_working,
      start_time,
      end_time
    FROM staff_availability
    WHERE staff_id = ?
      AND day_of_week = ?
    LIMIT 1
    `,
      [targetStaffId, appointmentDayOfWeek],
    );

    if (availabilityRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message:
            "Working hours have not been configured for this team member on this day",
        },
        {
          status: 409,
        },
      );
    }

    const availability = availabilityRows[0];

    if (!availability.is_working) {
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

    if (availability.start_time == null || availability.end_time == null) {
      await connection.rollback();

      return NextResponse.json(
        {
          message:
            "Working hours are not configured correctly for this team member",
        },
        {
          status: 409,
        },
      );
    }

    const workingStartMinutes = timeToMinutes(availability.start_time);

    const workingEndMinutes = timeToMinutes(availability.end_time);

    if (
      appointmentStartMinutes < workingStartMinutes ||
      appointmentEndMinutes > workingEndMinutes
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          message: `This team member works from ${availability.start_time} to ${availability.end_time} on this day`,
        },
        {
          status: 409,
        },
      );
    }

    // TIME OFF / BLOCKED PERIOD CHECK

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
      [targetStaffId, endAt, startAt],
    );

    if (timeOffRows.length > 0) {
      await connection.rollback();

      const blockedPeriod = timeOffRows[0];

      return NextResponse.json(
        {
          message: blockedPeriod.reason
            ? `This team member is unavailable during this time: ${blockedPeriod.reason}`
            : "This team member is unavailable during this time",
        },
        {
          status: 409,
        },
      );
    }
    // DOUBLE-BOOKING CHECK
    //
    // Existing appointment:
    // 10:00 ---------- 11:00
    //
    // New appointment:
    //       10:30 ---------- 11:30
    //
    // These overlap because:
    // existing.start < new.end
    // AND
    // existing.end > new.start

    const [conflictingAppointments]: any = await connection.query(
      `
        SELECT
          id,
          start_at,
          end_at
        FROM appointments
        WHERE business_id = ?
          AND staff_id = ?
          AND status <> 'CANCELLED'
          AND start_at < ?
          AND end_at > ?
        LIMIT 1
        `,
      [businessId, targetStaffId, endAt, startAt],
    );

    if (conflictingAppointments.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message:
            "This team member already has an appointment during this time",
        },
        {
          status: 409,
        },
      );
    }

    const [appointmentResult] = await connection.execute(
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
        startAt,
        endAt,
        "CONFIRMED",
        totalPrice,
        notes ?? null,
        userId,
      ],
    );

    const appointmentId = (appointmentResult as any).insertId;

    for (const service of validatedServices) {
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
        [
          appointmentId,
          service.serviceId,
          service.price,
          service.durationMinutes,
        ],
      );
    }

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

    await connection.commit();

    return NextResponse.json(
      {
        message: "Appointment created successfully",
        appointmentId,
        staffId: targetStaffId,
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

    console.error("POST appointment error:", error);

    return NextResponse.json(
      {
        message: "Failed to create appointment",
      },
      {
        status: 500,
      },
    );
  } finally {
    connection.release();
  }
}
