import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";
import type { LeaveType } from "@prisma/client";
import type { RequestWithUser } from "./auth.guard";
import { HrService } from "./hr.service";

@Controller()
export class HrController {
  constructor(@Inject(HrService) private readonly hr: HrService) {}

  @Get("dashboard")
  dashboard(@Req() req: RequestWithUser) {
    return this.hr.dashboard(req.user!);
  }

  @Get("departments")
  departments() {
    return this.hr.departments();
  }

  @Get("employees")
  employees(@Req() req: RequestWithUser, @Query("q") q?: string) {
    return this.hr.employees(req.user!, q);
  }

  @Get("employees/:id")
  employee(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.hr.employee(req.user!, id);
  }

  @Post("employees")
  createEmployee(@Req() req: RequestWithUser, @Body() body: Record<string, unknown>) {
    return this.hr.createEmployee(req.user!, body);
  }

  @Get("leave")
  leave(@Req() req: RequestWithUser) {
    return this.hr.leaveRequests(req.user!);
  }

  @Post("leave")
  requestLeave(
    @Req() req: RequestWithUser,
    @Body() body: { type?: LeaveType; startDate?: string; endDate?: string; days?: number; reason?: string },
  ) {
    return this.hr.requestLeave(req.user!, body);
  }

  @Post("leave/:id/decide")
  decide(@Req() req: RequestWithUser, @Param("id") id: string, @Body() body: { status?: "APPROVED" | "REJECTED" }) {
    return this.hr.decideLeave(req.user!, id, body.status === "REJECTED" ? "REJECTED" : "APPROVED");
  }

  @Get("attendance")
  attendance(@Query("month") month = "2026-09") {
    return this.hr.attendance(month);
  }

  @Get("attendance/template")
  template() {
    return { csv: this.hr.template() };
  }

  @Post("attendance/import")
  importAttendance(@Req() req: RequestWithUser, @Body() body: { month?: string; csv?: string }) {
    return this.hr.importAttendance(req.user!, body.month ?? "2026-09", body.csv ?? "");
  }

  @Get("attendance/period")
  attendancePeriod(@Query("month") month = "2026-09") {
    return this.hr.attendancePeriod(month);
  }

  @Post("attendance/lock")
  lockAttendance(@Req() req: RequestWithUser, @Body() body: { month?: string }) {
    return this.hr.lockAttendance(req.user!, body.month ?? "2026-09");
  }

  @Post("attendance/unlock")
  unlockAttendance(@Req() req: RequestWithUser, @Body() body: { month?: string }) {
    return this.hr.unlockAttendance(req.user!, body.month ?? "2026-09");
  }

  @Get("contracts")
  contracts() {
    return this.hr.contracts();
  }

  @Post("employees/:id/dependents")
  saveDependents(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() body: { people?: Array<{ fullName?: string; relation?: "CHILD" | "SPOUSE" | "PARENT" | "OTHER"; birthDate?: string }> },
  ) {
    return this.hr.saveDependents(req.user!, id, body.people ?? []);
  }

  @Post("employees/:id/offboard")
  offboard(@Req() req: RequestWithUser, @Param("id") id: string, @Body() body: { lastDay?: string; reason?: string }) {
    return this.hr.offboard(req.user!, id, body);
  }

  @Get("audit")
  audit(@Req() req: RequestWithUser) {
    return this.hr.listAudit(req.user!);
  }
}
