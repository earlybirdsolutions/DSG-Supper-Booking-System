import { clerkClient, getAuth } from "@clerk/express";
import {
  CheckEligibilityBody,
  CheckEligibilityResponse,
  CreateBookingBody,
  CreateBookingResponse,
  CreateStudentBody,
  CreateStudentResponse,
  DeleteStudentParams,
  GetAdminSettingsResponse,
  GetCurrentScholarResponse,
  GetKitchenDashboardQueryParams,
  GetKitchenDashboardResponse,
  GetPublicConfigResponse,
  ListAllBookingsQueryParams,
  ListAllBookingsResponse,
  ListScholarBookingsQueryParams,
  ListScholarBookingsResponse,
  ListStudentsResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
  UpdateStudentBody,
  UpdateStudentParams,
  UpdateStudentResponse,
  CancelBookingParams,
  CancelBookingResponse,
} from "@workspace/api-zod";
import {
  bookingsTable,
  db,
  settingsTable,
  studentsTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
const TIMEZONE = "Africa/Johannesburg";

type Identity = { email: string; name: string };

function localNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function cutoffPassed(date: string, cutoffTime: string) {
  const now = localNow();
  return date < now.date || (date === now.date && now.time >= cutoffTime);
}

function dateString(value: string | Date) {
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+02:00`));
}

function bookingResponse(booking: typeof bookingsTable.$inferSelect) {
  return {
    id: booking.id,
    studentEmail: booking.studentEmail,
    studentName: booking.studentName,
    bookingDate: booking.bookingDate,
    createdAt: booking.createdAt.toISOString(),
    status: booking.status as "confirmed" | "cancelled",
  };
}

async function getSettings() {
  const [settings] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, 1));
  if (settings) return settings;
  const [created] = await db.insert(settingsTable).values({ id: 1 }).returning();
  return created;
}

async function getIdentity(req: Request): Promise<Identity | null> {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) return null;
  const user = await clerkClient.users.getUser(userId);
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    email.split("@")[0];
  return { email: email.toLowerCase(), name };
}

async function requireAdmin(req: Request) {
  const identity = await getIdentity(req);
  if (!identity) return null;
  const settings = await getSettings();
  return settings.adminEmails.includes(identity.email) ? identity : null;
}

router.get("/config", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  res.json(
    GetPublicConfigResponse.parse({
      schoolName: "Diocesan School for Girls",
      cutoffTime: settings.cutoffTime,
      timezone: TIMEZONE,
      kitchenDashboardEnabled: true,
    }),
  );
});

router.post("/eligibility", async (req, res): Promise<void> => {
  const parsed = CheckEligibilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, email));
  const eligible = Boolean(student?.active);
  res.json(
    CheckEligibilityResponse.parse({
      eligible,
      name: student?.name ?? null,
      message: eligible
        ? "You are recognised. Continue to secure sign in."
        : "This email is not on the day scholar list. Please contact IT Solutions.",
    }),
  );
});

router.get("/me", async (req, res): Promise<void> => {
  const identity = await getIdentity(req);
  if (!identity) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, identity.email));
  const bookings = student
    ? await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.studentEmail, identity.email))
        .orderBy(desc(bookingsTable.bookingDate))
    : [];
  res.json(
    GetCurrentScholarResponse.parse({
      email: identity.email,
      name: student?.name ?? identity.name,
      grade: student?.grade ?? null,
      eligible: Boolean(student?.active),
      bookings: bookings.map(bookingResponse),
    }),
  );
});

router.get("/bookings", async (req, res): Promise<void> => {
  const identity = await getIdentity(req);
  if (!identity) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const parsed = ListScholarBookingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const conditions = [eq(bookingsTable.studentEmail, identity.email)];
  if (parsed.data.from)
    conditions.push(gte(bookingsTable.bookingDate, dateString(parsed.data.from)));
  if (parsed.data.to)
    conditions.push(lte(bookingsTable.bookingDate, dateString(parsed.data.to)));
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(and(...conditions))
    .orderBy(desc(bookingsTable.bookingDate));
  res.json(ListScholarBookingsResponse.parse(bookings.map(bookingResponse)));
});

router.post("/bookings", async (req, res): Promise<void> => {
  const identity = await getIdentity(req);
  if (!identity) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const body = CreateBookingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, identity.email));
  if (!student?.active) {
    res.status(403).json({ error: "This email is not eligible to book supper" });
    return;
  }
  const settings = await getSettings();
  const requestedDate = dateString(body.data.bookingDate);
  if (cutoffPassed(requestedDate, settings.cutoffTime)) {
    res.status(400).json({ error: "The booking cutoff has passed for this date" });
    return;
  }
  const [existing] = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.studentEmail, identity.email),
        eq(bookingsTable.bookingDate, requestedDate),
      ),
    );
  if (existing?.status === "confirmed") {
    res.status(409).json({ error: "You have already booked supper for this date" });
    return;
  }
  const [booking] = existing
    ? await db
        .update(bookingsTable)
        .set({ status: "confirmed", cancelledAt: null, createdAt: new Date() })
        .where(eq(bookingsTable.id, existing.id))
        .returning()
    : await db
        .insert(bookingsTable)
        .values({
          studentEmail: student.email,
          studentName: student.name,
          bookingDate: requestedDate,
          status: "confirmed",
        })
        .returning();
  req.log.info(
    {
      bookingId: booking.id,
      kitchenRecipientCount: settings.kitchenEmails.length,
      financeRecipientCount: settings.financeEmails.length,
    },
    "Supper booking confirmed and notification queued",
  );
  res.status(201).json(CreateBookingResponse.parse(bookingResponse(booking)));
});

router.post("/bookings/:id/cancel", async (req, res): Promise<void> => {
  const identity = await getIdentity(req);
  if (!identity) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const params = CancelBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.id, params.data.id),
        eq(bookingsTable.studentEmail, identity.email),
      ),
    );
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const settings = await getSettings();
  if (cutoffPassed(booking.bookingDate, settings.cutoffTime)) {
    res.status(400).json({ error: "The cancellation cutoff has passed" });
    return;
  }
  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(bookingsTable.id, booking.id))
    .returning();
  res.json(CancelBookingResponse.parse(bookingResponse(updated)));
});

router.get("/kitchen/dashboard", async (req, res): Promise<void> => {
  const parsed = GetKitchenDashboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const settings = await getSettings();
  const requestedDate = dateString(parsed.data.date);
  const rows = await db
    .select({
      booking: bookingsTable,
      grade: studentsTable.grade,
    })
    .from(bookingsTable)
    .leftJoin(
      studentsTable,
      eq(bookingsTable.studentEmail, studentsTable.email),
    )
    .where(
      and(
        eq(bookingsTable.bookingDate, requestedDate),
        eq(bookingsTable.status, "confirmed"),
      ),
    )
    .orderBy(asc(bookingsTable.studentName));
  res.json(
    GetKitchenDashboardResponse.parse({
      date: requestedDate,
      displayDate: displayDate(requestedDate),
      count: rows.length,
      cutoffTime: settings.cutoffTime,
      cutoffPassed: cutoffPassed(requestedDate, settings.cutoffTime),
      bookings: rows.map(({ booking, grade }) => ({
        id: booking.id,
        studentName: booking.studentName,
        studentEmail: booking.studentEmail,
        grade,
        bookedAt: booking.createdAt.toISOString(),
      })),
    }),
  );
});

router.get("/admin/settings", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  res.json(GetAdminSettingsResponse.parse(await getSettings()));
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const body = UpdateAdminSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [settings] = await db
    .update(settingsTable)
    .set(body.data)
    .where(eq(settingsTable.id, 1))
    .returning();
  res.json(UpdateAdminSettingsResponse.parse(settings));
});

router.get("/admin/students", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const students = await db
    .select()
    .from(studentsTable)
    .orderBy(asc(studentsTable.name));
  res.json(ListStudentsResponse.parse(students));
});

router.post("/admin/students", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const body = CreateStudentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [student] = await db
    .insert(studentsTable)
    .values({ ...body.data, email: body.data.email.toLowerCase() })
    .returning();
  res.status(201).json(CreateStudentResponse.parse(student));
});

router.patch("/admin/students/:email", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const params = UpdateStudentParams.safeParse(req.params);
  const body = UpdateStudentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid student update" });
    return;
  }
  const [student] = await db
    .update(studentsTable)
    .set(body.data)
    .where(eq(studentsTable.email, params.data.email.toLowerCase()))
    .returning();
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(UpdateStudentResponse.parse(student));
});

router.delete("/admin/students/:email", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const params = DeleteStudentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(studentsTable)
    .where(eq(studentsTable.email, params.data.email.toLowerCase()));
  res.sendStatus(204);
});

router.get("/admin/bookings", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const parsed = ListAllBookingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const conditions = [];
  if (parsed.data.from)
    conditions.push(gte(bookingsTable.bookingDate, dateString(parsed.data.from)));
  if (parsed.data.to)
    conditions.push(lte(bookingsTable.bookingDate, dateString(parsed.data.to)));
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bookingsTable.createdAt));
  res.json(ListAllBookingsResponse.parse(bookings.map(bookingResponse)));
});

export default router;