import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { HrService } from "./hr.service";
import { PayrollService } from "./payroll.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn", "log"] });
  const payroll = app.get(PayrollService);
  const hr = app.get(HrService);
  console.log(JSON.stringify({ worker: "ready", rule: payroll.statutory().ruleVersion }));
  let lastReminder = 0;
  for (;;) {
    if (Date.now() - lastReminder > 60 * 60 * 1000) {
      const reminder = await hr.remindContracts();
      lastReminder = Date.now();
      if (reminder.sent) console.log(JSON.stringify({ reminder, at: new Date().toISOString() }));
    }
    const id = await payroll.claimAndCalculate();
    if (id) console.log(JSON.stringify({ processed: id, at: new Date().toISOString() }));
    await new Promise((resolve) => setTimeout(resolve, id ? 200 : 1000));
  }
}

main();
