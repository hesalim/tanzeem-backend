import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthUser, requireActiveUser } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

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
      !Array.isArray(services) ||
      services.length === 0
    ) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
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
        { message: "Invalid appointment time" },
        { status: 400 },
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

    // Get existing appointment
    const [appointmentRows]: any = await connection.query(
      `
        SELECT
          id,
          staff_id,
          status
        FROM appointments
        WHERE id = ?
          AND business_id = ?
        LIMIT 1
        `,
      [id, businessId],
    );

    if (appointmentRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { message: "Appointment not found" },
        { status: 404 },
      );
    }

    const existingAppointment = appointmentRows[0];

    let targetStaffId: number;

    // STAFF may only edit their own appointment
    if (auth.role === "STAFF") {
      if (auth.staffId == null) {
        await connection.rollback();

        return NextResponse.json(
          { message: "Staff account is required" },
          { status: 403 },
        );
      }

      if (Number(existingAppointment.staff_id) !== auth.staffId) {
        await connection.rollback();

        return NextResponse.json(
          {
            message: "You can only edit your own appointments",
          },
          { status: 403 },
        );
      }

      targetStaffId = auth.staffId;
    }

    // OWNER can keep the existing staff
    // or reassign the appointment
    else if (auth.role === "OWNER") {
      targetStaffId = requestedStaffId
        ? Number(requestedStaffId)
        : Number(existingAppointment.staff_id);
    } else {
      await connection.rollback();

      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    // Validate target staff member
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
        { message: "Team member not found" },
        { status: 404 },
      );
    }

    const targetStaff = staffRows[0];

    // Validate customer
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
        { message: "Customer not found" },
        { status: 404 },
      );
    }

    let totalPrice = 0;

    const validatedServices: {
      serviceId: number;
      price: number;
      durationMinutes: number;
    }[] = [];

    for (const service of services) {
      const serviceId = Number(service.serviceId);

      if (!serviceId) {
        await connection.rollback();

        return NextResponse.json(
          { message: "Invalid service" },
          { status: 400 },
        );
      }

      let serviceRows: any;

      // Owner's staff record currently has access
      // to all active services.
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
        // Normal staff may only use
        // services assigned to them.
        const [rows]: any = await connection.query(
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
          { status: 400 },
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

    // AVAILABILITY CHECK

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
    // Exclude the appointment currently being edited.
    const [conflictingRows]: any = await connection.query(
      `
        SELECT id
        FROM appointments
        WHERE business_id = ?
          AND staff_id = ?
          AND id <> ?
          AND status <> 'CANCELLED'
          AND start_at < ?
          AND end_at > ?
        LIMIT 1
        `,
      [businessId, targetStaffId, id, endAt, startAt],
    );

    if (conflictingRows.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          message:
            "This team member already has an appointment during this time",
        },
        { status: 409 },
      );
    }

    const [updateResult]: any = await connection.execute(
      `
        UPDATE appointments
        SET
          customer_id = ?,
          staff_id = ?,
          start_at = ?,
          end_at = ?,
          total_price = ?,
          notes = ?
        WHERE id = ?
          AND business_id = ?
        `,
      [
        customerId,
        targetStaffId,
        startAt,
        endAt,
        totalPrice,
        notes ?? null,
        id,
        businessId,
      ],
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();

      return NextResponse.json(
        { message: "Appointment not found" },
        { status: 404 },
      );
    }

    await connection.execute(
      `
      DELETE FROM appointment_services
      WHERE appointment_id = ?
      `,
      [id],
    );

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
        [id, service.serviceId, service.price, service.durationMinutes],
      );
    }

    const reminderScheduledAt = new Date(
      startDate.getTime() - 24 * 60 * 60 * 1000,
    );

    if (reminderScheduledAt > new Date()) {
      await connection.execute(
        `
    UPDATE appointment_reminders
    SET
      scheduled_at = ?,
      status = 'PENDING',
      attempt_count = 0,
      provider_message_id = NULL,
      last_error = NULL,
      sent_at = NULL,
      delivered_at = NULL,
      read_at = NULL
    WHERE appointment_id = ?
      AND channel = 'WHATSAPP'
    `,
        [reminderScheduledAt, id],
      );
    } else {
      await connection.execute(
        `
    UPDATE appointment_reminders
    SET status = 'CANCELLED'
    WHERE appointment_id = ?
      AND channel = 'WHATSAPP'
      AND status IN ('PENDING', 'FAILED')
    `,
        [id],
      );
    }

    await connection.commit();

    return NextResponse.json({
      message: "Appointment updated successfully",
      staffId: targetStaffId,
    });
  } catch (error: any) {
    try {
      await connection.rollback();
    } catch {}

    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        {
          message: "This account is inactive",
        },
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

    console.error("PUT appointment error:", error);

    return NextResponse.json(
      {
        message: "Failed to update appointment",
      },
      { status: 500 },
    );
  } finally {
    connection.release();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

    const body = await request.json();

    const { status } = body;

    if (
      status !== "CONFIRMED" &&
      status !== "COMPLETED" &&
      status !== "CANCELLED"
    ) {
      return NextResponse.json(
        {
          message: "Invalid appointment status",
        },
        { status: 400 },
      );
    }

    // First fetch the appointment so we can
    // check ownership for STAFF.
    const [appointmentRows]: any = await pool.query(
      `
        SELECT
          id,
          staff_id
        FROM appointments
        WHERE id = ?
          AND business_id = ?
        LIMIT 1
        `,
      [id, businessId],
    );

    if (appointmentRows.length === 0) {
      return NextResponse.json(
        { message: "Appointment not found" },
        { status: 404 },
      );
    }

    const appointment = appointmentRows[0];

    // STAFF may only change their own appointment
    if (auth.role === "STAFF") {
      if (auth.staffId == null) {
        return NextResponse.json(
          { message: "Staff account is required" },
          { status: 403 },
        );
      }

      if (Number(appointment.staff_id) !== auth.staffId) {
        return NextResponse.json(
          {
            message: "You can only update your own appointments",
          },
          { status: 403 },
        );
      }
    } else if (auth.role !== "OWNER") {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    const [result]: any = await pool.execute(
      `
        UPDATE appointments
        SET status = ?
        WHERE id = ?
          AND business_id = ?
        `,
      [status, id, businessId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Appointment not found" },
        { status: 404 },
      );
    }

    if (status === "CANCELLED") {
      await pool.execute(
        `
    UPDATE appointment_reminders
    SET status = 'CANCELLED'
    WHERE appointment_id = ?
      AND business_id = ?
      AND channel = 'WHATSAPP'
      AND status IN ('PENDING', 'FAILED')
    `,
        [id, businessId],
      );
    }

    return NextResponse.json({
      message: "Appointment status updated successfully",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (error.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        {
          message: "This account is inactive",
        },
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

    console.error("PATCH appointment error:", error);

    return NextResponse.json(
      {
        message: "Failed to update appointment status",
      },
      { status: 500 },
    );
  }
}
