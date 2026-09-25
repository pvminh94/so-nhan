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

  @Get("reports")
  reports(@Req() req: RequestWithUser) {
    return this.hr.reports(req.user!);
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

  @Get("team")
  team(@Req() req: RequestWithUser) {
    return this.hr.team(req.user!);
  }

  @Get("attendance")
  attendance(@Req() req: RequestWithUser, @Query("month") month = "2026-09") {
    return this.hr.attendance(req.user!, month);
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
  contracts(@Req() req: RequestWithUser) {
    return this.hr.contracts(req.user!);
  }

  @Post("contracts/remind")
  remindContracts(@Req() req: RequestWithUser) {
    return this.hr.remindContractsFor(req.user!);
  }

  @Post("employees/:id/dependents")
  saveDependents(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() body: { people?: Array<{ fullName?: string; relation?: "CHILD" | "SPOUSE" | "PARENT" | "OTHER"; birthDate?: string }> },
  ) {
    return this.hr.saveDependents(req.user!, id, body.people ?? []);
  }

  @Post("employees/:id/allowances")
  saveAllowances(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() body: { items?: Array<{ code?: string; name?: string; amount?: number; taxable?: boolean }> },
  ) {
    return this.hr.saveAllowances(req.user!, id, body.items ?? []);
  }

  @Post("employees/:id/transfer")
  transfer(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Body() body: { departmentId?: string; jobTitle?: string; reason?: string; effectiveDate?: string },
  ) {
    return this.hr.transfer(req.user!, id, body);
  }

  @Post("employees/:id/offboard")
  offboard(@Req() req: RequestWithUser, @Param("id") id: string, @Body() body: { lastDay?: string; reason?: string }) {
    return this.hr.offboard(req.user!, id, body);
  }

  @Get("notifications")
  notifications(@Req() req: RequestWithUser) {
    return this.hr.notifications(req.user!);
  }

  @Post("notifications/read")
  readNotifications(@Req() req: RequestWithUser) {
    return this.hr.readNotifications(req.user!);
  }

  @Get("audit")
  audit(@Req() req: RequestWithUser) {
    return this.hr.listAudit(req.user!);
  }
}
