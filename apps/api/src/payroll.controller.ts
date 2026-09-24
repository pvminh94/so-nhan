import { Body, Controller, Get, Header, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import type { RequestWithUser } from "./auth.guard";
import { PayrollService } from "./payroll.service";

@Controller()
export class PayrollController {
  constructor(@Inject(PayrollService) private readonly payroll: PayrollService) {}

  @Get("statutory")
  statutory(@Query("year") year?: string, @Query("month") month?: string) {
    const period = year && month ? { year: Number(year), month: Number(month) } : { year: 2026, month: 9 };
    return this.payroll.statutory(period);
  }

  @Post("statutory")
  addRule(
    @Req() req: RequestWithUser,
    @Body() body: { version?: string; validFrom?: number; validTo?: number; note?: string; referenceWage?: number },
  ) {
    return this.payroll.addRule(req.user!, body);
  }

  @Get("payroll/runs")
  runs() {
    return this.payroll.runs();
  }

  @Get("payroll/runs/:id")
  run(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.payroll.run(req.user!, id);
  }

  @Get("payroll/runs/:id/variance")
  variance(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.payroll.variance(req.user!, id);
  }

  @Post("payroll/runs")
  calculate(@Req() req: RequestWithUser, @Body() body: { year?: number; month?: number }) {
    return this.payroll.calculate(req.user!, Number(body.year), Number(body.month));
  }

  @Post("payroll/runs/:id/lock")
  lock(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.payroll.lock(req.user!, id);
  }

  @Get("payroll/runs/:id/bank")
  bankSummary(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.payroll.bankFile(req.user!, id);
  }

  @Post("payroll/runs/:id/bank/check")
  checkBank(@Req() req: RequestWithUser, @Param("id") id: string, @Body() body: { csv?: string }) {
    return this.payroll.checkBankCsv(req.user!, id, body.csv ?? "");
  }

  @Get("payroll/runs/:id/bank.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async bank(@Req() req: RequestWithUser, @Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Content-Disposition", `attachment; filename="luong-${id}.csv"`);
    return this.payroll.bankCsv(req.user!, id);
  }

  @Get("payroll/runs/:id/journal.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async journal(@Req() req: RequestWithUser, @Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Content-Disposition", `attachment; filename="but-toan-${id}.csv"`);
    return this.payroll.journalCsv(req.user!, id);
  }
}
