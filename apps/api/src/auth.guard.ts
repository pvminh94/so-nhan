import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { COOKIE, readCookie, type AuthUser } from "./common";
import { PrismaService } from "./prisma.service";

export type RequestWithUser = Request & { user?: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const path = req.path || req.url || "";
    if (path.includes("/health") || path.endsWith("/auth/login")) return true;

    const token = readCookie(req.headers.cookie, COOKIE);
    if (!token) throw new UnauthorizedException("Chưa đăng nhập");
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Phiên hết hạn");
    }
    req.user = session.user;
    return true;
  }
}
