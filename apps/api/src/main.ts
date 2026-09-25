import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? true, credentials: true });
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.BIND_HOST ?? "0.0.0.0";
  await app.listen(port, host);
}

bootstrap();
