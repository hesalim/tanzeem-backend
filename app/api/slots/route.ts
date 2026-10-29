import { NextResponse } from "next/server";
import pool from "@/lib/db";

const SLOT_INTERVAL_MINUTES = 5;

function timeToMinutes(value: string) {
  const parts = value.toString().split(":");

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
}

function getNextDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);

  value.setUTCDate(value.getUTCDate() + 1);

  return value.toISOString().substring(0, 10);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const { searchParams } = new URL(request.url);

    const date = searchParams.get("date");
    const staffId = Number(searchParams.get("staffId"));
    const serviceId = Number(searchParams.get("serviceId"));

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          message: "A valid date is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!staffId) {
      return NextResponse.json(
        {
          message: "Team member is required",
        },
        {
          status: 400,
        },
      );
    }

    if (!serviceId) {
      return NextResponse.json(
        {
          message: "Service is required",
        },
        {
          status: 400,
        },
      );
    }

    // -----------------------------------------
    // BUSINESS WEBSITE
    // -----------------------------------------

    const [siteRows]: any = await pool.query(
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

    // -----------------------------------------
    // VALIDATE STAFF
    // -----------------------------------------

    const [staffRows]: any = await pool.query(
      `
      SELECT
        id
      FROM staff
      WHERE id = ?
        AND business_id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [staffId, businessId],
    );

    if (staffRows.length === 0) {
      return NextResponse.json(
        {
          message: "Team member not found",
        },
        {
          status: 404,
        },
      );
    }

    // -----------------------------------------
    // VALIDATE SERVICE + STAFF ASSIGNMENT
    // -----------------------------------------

    const [serviceRows]: any = await pool.query(
      `
      SELECT
        s.id,
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
      [serviceId, businessId, staffId],
    );

    if (serviceRows.length === 0) {
      return NextResponse.json(
        {
          message: "Service is not available for this team member",
        },
        {
          status: 400,
        },
      );
    }

    const durationMinutes = Number(serviceRows[0].duration_minutes);

    if (durationMinutes <= 0) {
      return NextResponse.json(
        {
          message: "Invalid service duration",
        },
        {
          status: 400,
        },
      );
    }

    // -----------------------------------------
    // DAY OF WEEK
    // Monday = 1
    // ...
    // Sunday = 7
    // -----------------------------------------

    const dateValue = new Date(`${date}T12:00:00Z`);

    const jsDay = dateValue.getUTCDay();

    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    // -----------------------------------------
    // BUSINESS HOURS
    // -----------------------------------------

    const [businessHoursRows]: any = await pool.query(
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
      [businessId, dayOfWeek],
    );

    if (businessHoursRows.length === 0) {
      return NextResponse.json({
        date,
        staffId,
        serviceId,
        durationMinutes,
        slots: [],
        reason: "BUSINESS_HOURS_NOT_CONFIGURED",
      });
    }

    const businessHours = businessHoursRows[0];

    if (!businessHours.is_open) {
      return NextResponse.json({
        date,
        staffId,
        serviceId,
        durationMinutes,
        slots: [],
        reason: "BUSINESS_CLOSED",
      });
    }

    if (businessHours.open_time == null || businessHours.close_time == null) {
      return NextResponse.json({
        date,
        staffId,
        serviceId,
        durationMinutes,
        slots: [],
        reason: "BUSINESS_HOURS_NOT_CONFIGURED",
      });
    }

    const businessStart = timeToMinutes(businessHours.open_time);

    const businessEnd = timeToMinutes(businessHours.close_time);

    // -----------------------------------------
    // STAFF AVAILABILITY
    //
    // IMPORTANT:
    // No LIMIT 1.
    // A staff member can have:
    //
    // 08:00 - 12:00
    // 14:00 - 18:00
    //
    // on the same day.
    // -----------------------------------------

    const [availabilityRows]: any = await pool.query(
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
      [staffId, dayOfWeek],
    );

    if (availabilityRows.length === 0) {
      return NextResponse.json({
        date,
        staffId,
        serviceId,
        durationMinutes,
        slots: [],
        reason: "STAFF_HOURS_NOT_CONFIGURED",
      });
    }

    const workingPeriods = availabilityRows.filter(
      (row: any) =>
        row.is_working && row.start_time != null && row.end_time != null,
    );

    if (workingPeriods.length === 0) {
      return NextResponse.json({
        date,
        staffId,
        serviceId,
        durationMinutes,
        slots: [],
        reason: "STAFF_NOT_WORKING",
      });
    }

    // -----------------------------------------
    // INTERSECT EVERY STAFF PERIOD
    // WITH BUSINESS HOURS
    // -----------------------------------------

    const availablePeriods: {
      start: number;
      end: number;
    }[] = [];

    for (const period of workingPeriods) {
      const staffStart = timeToMinutes(period.start_time);

      const staffEnd = timeToMinutes(period.end_time);

      const availableStart = Math.max(businessStart, staffStart);

      const availableEnd = Math.min(businessEnd, staffEnd);

      if (availableEnd > availableStart) {
        availablePeriods.push({
          start: availableStart,
          end: availableEnd,
        });
      }
    }

    if (availablePeriods.length === 0) {
      return NextResponse.json({
        date,
        staffId,
        serviceId,
        durationMinutes,
        slots: [],
        reason: "NO_WORKING_WINDOW",
      });
    }

    // -----------------------------------------
    // SELECTED DAY
    // -----------------------------------------

    const nextDate = getNextDate(date);

    const dayStart = `${date} 00:00:00`;

    const nextDayStart = `${nextDate} 00:00:00`;

    // -----------------------------------------
    // EXISTING APPOINTMENTS
    // -----------------------------------------

    const [appointmentRows]: any = await pool.query(
      `
      SELECT
        TIMESTAMPDIFF(
          MINUTE,
          ?,
          start_at
        ) AS start_minute,

        TIMESTAMPDIFF(
          MINUTE,
          ?,
          end_at
        ) AS end_minute

      FROM appointments

      WHERE business_id = ?
        AND staff_id = ?
        AND status <> 'CANCELLED'

        AND start_at < ?
        AND end_at > ?
      `,
      [dayStart, dayStart, businessId, staffId, nextDayStart, dayStart],
    );

    // -----------------------------------------
    // STAFF TIME OFF
    // -----------------------------------------

    const [timeOffRows]: any = await pool.query(
      `
      SELECT
        TIMESTAMPDIFF(
          MINUTE,
          ?,
          GREATEST(
            start_at,
            ?
          )
        ) AS start_minute,

        TIMESTAMPDIFF(
          MINUTE,
          ?,
          LEAST(
            end_at,
            ?
          )
        ) AS end_minute

      FROM staff_time_off

      WHERE staff_id = ?
        AND start_at < ?
        AND end_at > ?
      `,
      [
        dayStart,
        dayStart,
        dayStart,
        nextDayStart,
        staffId,
        nextDayStart,
        dayStart,
      ],
    );

    const blockedPeriods = [...appointmentRows, ...timeOffRows].map(
      (item: any) => ({
        start: Number(item.start_minute),
        end: Number(item.end_minute),
      }),
    );

    // -----------------------------------------
    // GENERATE SLOTS
    // -----------------------------------------

    const slots: {
      startTime: string;
      endTime: string;
      startAt: string;
      endAt: string;
    }[] = [];

    const candidateStarts = new Set<number>();

    // Generate slots for EVERY working period.
    for (const period of availablePeriods) {
      for (
        let slotStart = period.start;
        slotStart + durationMinutes <= period.end;
        slotStart += SLOT_INTERVAL_MINUTES
      ) {
        candidateStarts.add(slotStart);
      }
    }

    // Also allow an appointment to begin exactly
    // when another appointment ends,
    // but only if that time falls inside one of
    // the employee's working periods.
    for (const appointment of appointmentRows) {
      const appointmentEnd = Number(appointment.end_minute);

      const fitsWorkingPeriod = availablePeriods.some(
        (period) =>
          appointmentEnd >= period.start &&
          appointmentEnd + durationMinutes <= period.end,
      );

      if (fitsWorkingPeriod) {
        candidateStarts.add(appointmentEnd);
      }
    }

    const sortedCandidateStarts = [...candidateStarts].sort((a, b) => a - b);

    for (const slotStart of sortedCandidateStarts) {
      const slotEnd = slotStart + durationMinutes;

      const insideWorkingPeriod = availablePeriods.some(
        (period) => slotStart >= period.start && slotEnd <= period.end,
      );

      if (!insideWorkingPeriod) {
        continue;
      }

      const overlaps = blockedPeriods.some(
        (blocked) => slotStart < blocked.end && slotEnd > blocked.start,
      );

      if (overlaps) {
        continue;
      }

      const startTime = minutesToTime(slotStart);

      const endTime = minutesToTime(slotEnd);

      slots.push({
        startTime,
        endTime,
        startAt: `${date}T${startTime}:00`,
        endAt: `${date}T${endTime}:00`,
      });
    }

    return NextResponse.json({
      date,
      staffId,
      serviceId,
      durationMinutes,
      intervalMinutes: SLOT_INTERVAL_MINUTES,
      slots,
    });
  } catch (error) {
    console.error("PUBLIC SLOTS ERROR:", error);

    return NextResponse.json(
      {
        message: "Failed to load available slots",
      },
      {
        status: 500,
      },
    );
  }
}
