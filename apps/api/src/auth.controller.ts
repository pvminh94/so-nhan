import { Body, Controller, Get, Inject, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import type { Response } from "express";
import { assertLoginAllowed, clearSessionCookie, clientIp, newToken, setSessionCookie } from "./common";
import type { RequestWithUser } from "./auth.guard";
import { PrismaService } from "./prisma.service";

@Controller("auth")
export class AuthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post("login")
  async login(
    @Body() body: { email?: string; password?: string },
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      assertLoginAllowed(clientIp(req));
    } catch (error) {
      throw new UnauthorizedException(error instanceof Error ? error.message : "Từ chối");
    }
    const email = (body.email ?? "").trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = user ? await compare(body.password ?? "", user.passwordHash) : false;
    if (!user || !ok) {
      await this.prisma.auditLog.create({
        data: { action: "LOGIN_FAILED", entity: "User", meta: { email } },
      });
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }
    const token = newToken();
    await this.prisma.session.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    });
    setSessionCookie(res, token);
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: "LOGIN", entity: "User", entityId: user.id },
    });
    return publicUser(user);
  }

  @Post("logout")
  async logout(@Req() req: RequestWithUser, @Res({ passthrough: true }) res: Response) {
    const token = req.headers.cookie?.match(/(?:^|; )sn_session=([^;]+)/)?.[1];
    if (token) await this.prisma.session.deleteMany({ where: { token: decodeURIComponent(token) } });
    clearSessionCookie(res);
    return { ok: true };
  }

  @Get("me")
  me(@Req() req: RequestWithUser) {
    return publicUser(req.user!);
  }

  @Post("change-password")
  async changePassword(@Req() req: RequestWithUser, @Body() body: { current?: string; next?: string }) {
    const next = body.next ?? "";
    if (next.length < 8) throw new UnauthorizedException("Mật khẩu mới cần ít nhất 8 ký tự");
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const ok = await compare(body.current ?? "", user.passwordHash);
    if (!ok) throw new UnauthorizedException("Mật khẩu hiện tại không đúng");
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(next, 10) },
    });
    await this.prisma.session.deleteMany({ where: { userId: user.id } });
    return { ok: true };
  }
}

function publicUser(user: { id: string; email: string; fullName: string; role: string; employeeId: string | null }) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    employeeId: user.employeeId,
  };
}
