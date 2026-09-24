import { Body, Controller, Get, Header, Inject, Param, Post, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import type { RequestWithUser } from "./auth.guard";
import { PayrollService } from "./payroll.service";

@Controller()
export class PayrollController {
  constructor(@Inject(PayrollService) private readonly payroll: PayrollService) {}

  @Get("statutory")
  statutory() {
    return this.payroll.statutory({ year: 2026, month: 9 });
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
