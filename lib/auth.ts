import jwt from "jsonwebtoken";
import pool from "@/lib/db";
export type AuthUser = {
  userId: number;
  businessId: number | null;
  staffId: number | null;
  role: string;
};

export function getAuthUser(request: Request): AuthUser {
  const authorization = request.headers.get("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const token = authorization.substring(7);

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }

  try {
    return jwt.verify(token, secret) as AuthUser;
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}

export function requireOwner(auth: AuthUser) {
  if (auth.role !== "OWNER") {
    throw new Error("FORBIDDEN");
  }
}

export async function requireActiveUser(auth: AuthUser) {
  const [rows]: any = await pool.query(
    `
    SELECT
      id,
      is_active
    FROM users
    WHERE id = ?
      AND is_active = TRUE
    LIMIT 1
    `,
    [auth.userId],
  );

  if (rows.length === 0) {
    throw new Error("ACCOUNT_INACTIVE");
  }

  if (auth.role === "STAFF") {
    if (auth.staffId == null) {
      throw new Error("STAFF_ACCOUNT_NOT_LINKED");
    }

    const [staffRows]: any = await pool.query(
      `
      SELECT id
      FROM staff
      WHERE id = ?
        AND user_id = ?
        AND is_active = TRUE
      LIMIT 1
      `,
      [auth.staffId, auth.userId],
    );

    if (staffRows.length === 0) {
      throw new Error("ACCOUNT_INACTIVE");
    }
  }
}
