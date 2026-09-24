import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PayrollService } from "./payroll.service";
import { PrismaService } from "./prisma.service";

/**
 * Tiến trình worker trên VPS API. Cùng codebase với HTTP, không phải microservice.
 * Bản này kiểm tra kết nối và in hàng đợi. Tính lương đồng bộ vẫn đi qua API;
 * khi bật Redis/BullMQ, job kỳ lương được chuyển vào đây.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const payroll = app.get(PayrollService);
  const open = await prisma.payrollRun.count({ where: { status: "CALCULATED" } });
  const snapshot = payroll.statutory();
  console.log(JSON.stringify({ worker: "ready", openRuns: open, rule: snapshot.ruleVersion }));
  await app.close();
}

main();
