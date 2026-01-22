import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";

// SAML設定は後で追加可能
// 現時点では開発用のCredentials認証を使用
const config: NextAuthConfig = {
  providers: [
    // 開発用: Credentials認証
    // 本番ではSAML IdPを設定
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        loginId: { label: "Login ID (optional)", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const email = credentials.email as string;
        const loginId = (credentials.loginId as string) || null;

        // メールアドレスでユーザーを検索
        let user = await prisma.user.findUnique({
          where: { email },
          include: { department: true },
        });

        if (!user) {
          // loginIdで既存ユーザーを検索（エージェントが先にデータを送った場合）
          if (loginId) {
            const existingUser = await prisma.user.findUnique({
              where: { loginId },
            });
            if (existingUser) {
              // placeholder.localのメールを本物のメールに更新
              if (existingUser.email.endsWith("@placeholder.local")) {
                user = await prisma.user.update({
                  where: { id: existingUser.id },
                  data: { email },
                  include: { department: true },
                });
              } else {
                // 既に別のメールが設定されている場合はエラー
                return null;
              }
            }
          }

          // まだユーザーが見つからない場合は新規作成
          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                loginId,
                name: email.split("@")[0],
              },
              include: { department: true },
            });
          }
        } else if (loginId && !user.loginId) {
          // 既存ユーザーにloginIdを紐づけ
          user = await prisma.user.update({
            where: { id: user.id },
            data: { loginId },
            include: { department: true },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          departmentId: user.departmentId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.departmentId = (user as { departmentId?: string }).departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { departmentId?: string }).departmentId =
          token.departmentId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
