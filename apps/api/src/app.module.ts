import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { HrController } from "./hr.controller";
import { HrService } from "./hr.service";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";
import { PrismaService } from "./prisma.service";
import { Controller, Get } from "@nestjs/common";

@Controller("health")
class HealthController {
  @Get()
  health() {
    return { ok: true, service: "so-nhan-api" };
  }
}

@Module({
  controllers: [HealthController, AuthController, HrController, PayrollController],
  providers: [PrismaService, HrService, PayrollService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
