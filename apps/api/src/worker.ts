import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PayrollService } from "./payroll.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn", "log"] });
  const payroll = app.get(PayrollService);
  console.log(JSON.stringify({ worker: "ready", rule: payroll.statutory().ruleVersion }));
  for (;;) {
    const id = await payroll.claimAndCalculate();
    if (id) console.log(JSON.stringify({ processed: id, at: new Date().toISOString() }));
    await new Promise((resolve) => setTimeout(resolve, id ? 200 : 1000));
  }
}

main();
