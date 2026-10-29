"use client";

import { useState } from "react";

type Service = {
  id: number;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: string;
};

type Staff = {
  id: number;
  first_name: string;
  last_name: string | null;
};

type BookingFlowProps = {
  slug: string;
  services: Service[];
};

export default function BookingFlow({ slug, services }: BookingFlowProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [staff, setStaff] = useState<Staff[]>([]);

  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  async function selectService(service: Service) {
    setSelectedService(service);
    setSelectedStaff(null);
    setStaff([]);
    setIsLoadingStaff(true);

    try {
      const response = await fetch(
        `/api/public/business/${slug}?serviceId=${service.id}`,
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setStaff(data.staff ?? []);
    } finally {
      setIsLoadingStaff(false);
    }
  }
  async function loadSlots(date: string, staffMember: Staff, service: Service) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);

    if (!date) {
      return;
    }

    setIsLoadingSlots(true);

    try {
      const response = await fetch(
        `/api/public/business/${slug}/slots?staffId=${staffMember.id}&serviceId=${service.id}&date=${date}`,
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setSlots(data.slots ?? []);
    } finally {
      setIsLoadingSlots(false);
    }
  }
  async function confirmBooking() {
    if (!selectedService || !selectedStaff || !selectedSlot) {
      return;
    }

    if (!firstName.trim() || !phone.trim()) {
      setBookingError("First name and phone number are required.");
      return;
    }

    setBookingError("");
    setIsBooking(true);

    try {
      const response = await fetch(`/api/public/business/${slug}/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          email,
          notes,

          staffId: selectedStaff.id,
          serviceId: selectedService.id,

          startAt: selectedSlot.startAt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setBookingError(data.message ?? "Failed to book appointment.");

        return;
      }

      setBookingSuccess(true);
    } catch {
      setBookingError("Something went wrong. Please try again.");
    } finally {
      setIsBooking(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        textAlign: "left",
      }}
    >
      {!selectedService && (
        <>
          <h3
            style={{
              fontSize: "28px",
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            Choose a service
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => selectService(service)}
                style={{
                  textAlign: "left",
                  padding: "22px",
                  borderRadius: "18px",
                  border: "1px solid #e3d8d2",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                  }}
                >
                  {service.name}
                </div>

                <div
                  style={{
                    marginTop: "10px",
                    color: "#756a64",
                  }}
                >
                  {service.duration_minutes} min
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    fontWeight: 700,
                  }}
                >
                  ${Number(service.price).toFixed(2)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedService && (
        <>
          <button
            type="button"
            onClick={() => {
              setSelectedService(null);
              setSelectedStaff(null);
              setStaff([]);
            }}
            style={{
              border: 0,
              background: "transparent",
              cursor: "pointer",
              marginBottom: "20px",
            }}
          >
            ← Back
          </button>

          <h3
            style={{
              fontSize: "28px",
              marginBottom: "8px",
            }}
          >
            Choose a professional
          </h3>

          <p
            style={{
              color: "#756a64",
              marginBottom: "24px",
            }}
          >
            {selectedService.name}
          </p>

          {isLoadingStaff && <p>Loading team members...</p>}

          {!isLoadingStaff && staff.length === 0 && (
            <p>No team member is currently available for this service.</p>
          )}

          {!isLoadingStaff && staff.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              {staff.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedStaff(member)}
                  style={{
                    textAlign: "left",
                    padding: "22px",
                    borderRadius: "18px",
                    border:
                      selectedStaff?.id === member.id
                        ? "2px solid #1f1a17"
                        : "1px solid #e3d8d2",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                    }}
                  >
                    {member.first_name} {member.last_name ?? ""}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedStaff && selectedService && (
            <div
              style={{
                marginTop: "30px",
                padding: "24px",
                borderRadius: "18px",
                background: "#fff",
                border: "1px solid #e3d8d2",
              }}
            >
              <strong>
                {selectedService.name} with {selectedStaff.first_name}{" "}
                {selectedStaff.last_name ?? ""}
              </strong>

              <div
                style={{
                  marginTop: "24px",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: "8px",
                  }}
                >
                  Choose a date
                </label>

                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(event) =>
                    loadSlots(
                      event.target.value,
                      selectedStaff,
                      selectedService,
                    )
                  }
                  style={{
                    width: "100%",
                    maxWidth: "280px",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #d9cec8",
                    fontSize: "15px",
                  }}
                />
              </div>

              {isLoadingSlots && (
                <p style={{ marginTop: "20px" }}>Loading available times...</p>
              )}

              {!isLoadingSlots && selectedDate && slots.length === 0 && (
                <p
                  style={{
                    marginTop: "20px",
                    color: "#756a64",
                  }}
                >
                  No available times for this date.
                </p>
              )}

              {!isLoadingSlots && slots.length > 0 && (
                <div
                  style={{
                    marginTop: "24px",
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  {slots.map((slot) => (
                    <button
                      key={slot.startAt}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: "11px 16px",
                        borderRadius: "999px",
                        border:
                          selectedSlot?.startAt === slot.startAt
                            ? "2px solid #1f1a17"
                            : "1px solid #d9cec8",
                        background:
                          selectedSlot?.startAt === slot.startAt
                            ? "#1f1a17"
                            : "#fff",
                        color:
                          selectedSlot?.startAt === slot.startAt
                            ? "#fff"
                            : "#1f1a17",
                        cursor: "pointer",
                      }}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
              {selectedSlot && !bookingSuccess && (
                <div
                  style={{
                    marginTop: "30px",
                    paddingTop: "26px",
                    borderTop: "1px solid #eadfd9",
                  }}
                >
                  <div
                    style={{
                      marginBottom: "24px",
                      padding: "16px",
                      borderRadius: "14px",
                      background: "#f7f1ed",
                    }}
                  >
                    Selected time:{" "}
                    <strong>
                      {selectedSlot.startTime} → {selectedSlot.endTime}
                    </strong>
                  </div>

                  <h3
                    style={{
                      fontSize: "24px",
                      marginBottom: "20px",
                    }}
                  >
                    Your details
                  </h3>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "7px",
                          fontWeight: 600,
                        }}
                      >
                        First name *
                      </label>

                      <input
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        style={{
                          width: "100%",
                          padding: "13px",
                          borderRadius: "12px",
                          border: "1px solid #d9cec8",
                          fontSize: "15px",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "7px",
                          fontWeight: 600,
                        }}
                      >
                        Last name
                      </label>

                      <input
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        style={{
                          width: "100%",
                          padding: "13px",
                          borderRadius: "12px",
                          border: "1px solid #d9cec8",
                          fontSize: "15px",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "7px",
                          fontWeight: 600,
                        }}
                      >
                        Phone *
                      </label>

                      <input
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+961..."
                        style={{
                          width: "100%",
                          padding: "13px",
                          borderRadius: "12px",
                          border: "1px solid #d9cec8",
                          fontSize: "15px",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "7px",
                          fontWeight: 600,
                        }}
                      >
                        Email
                      </label>

                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        style={{
                          width: "100%",
                          padding: "13px",
                          borderRadius: "12px",
                          border: "1px solid #d9cec8",
                          fontSize: "15px",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "16px",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        marginBottom: "7px",
                        fontWeight: 600,
                      }}
                    >
                      Notes
                    </label>

                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "13px",
                        borderRadius: "12px",
                        border: "1px solid #d9cec8",
                        fontSize: "15px",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  {bookingError && (
                    <p
                      style={{
                        marginTop: "16px",
                        color: "#b42318",
                      }}
                    >
                      {bookingError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={confirmBooking}
                    disabled={isBooking}
                    style={{
                      marginTop: "22px",
                      width: "100%",
                      border: 0,
                      background: "#1f1a17",
                      color: "#fff",
                      padding: "15px 22px",
                      borderRadius: "999px",
                      fontSize: "16px",
                      fontWeight: 600,
                      cursor: isBooking ? "not-allowed" : "pointer",
                      opacity: isBooking ? 0.65 : 1,
                    }}
                  >
                    {isBooking ? "Booking..." : "Confirm Booking"}
                  </button>
                </div>
              )}

              {bookingSuccess && (
                <div
                  style={{
                    marginTop: "30px",
                    padding: "30px",
                    borderRadius: "18px",
                    background: "#f4f8f4",
                    border: "1px solid #d5e5d5",
                    textAlign: "center",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "26px",
                      marginBottom: "10px",
                    }}
                  >
                    Appointment confirmed ✓
                  </h3>

                  <p
                    style={{
                      color: "#667066",
                      margin: 0,
                    }}
                  >
                    Your appointment has been booked successfully.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
