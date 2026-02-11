import NextAuth from "next-auth";
import type { NextAuthConfig, Account, Profile } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Keycloak from "next-auth/providers/keycloak";
import { prisma } from "./prisma";

// ユーザー検索・作成の共通ロジック
async function findOrCreateUser(
  email: string,
  loginId: string | null,
  name: string | null
) {
  // 1. emailでユーザーを検索
  let user = await prisma.user.findUnique({
    where: { email },
    include: {
      departmentMembers: {
        include: { department: true },
        where: { isPrimary: true },
        take: 1,
      },
    },
  });

  if (user) {
    // loginIdが未設定なら紐づけ
    if (loginId && !user.loginId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { loginId },
        include: {
          departmentMembers: {
            include: { department: true },
            where: { isPrimary: true },
            take: 1,
          },
        },
      });
    }
    return user;
  }

  // 2. loginIdで既存ユーザーを検索（エージェントが先にデータを送った場合）
  if (loginId) {
    const existingUser = await prisma.user.findUnique({
      where: { loginId },
      include: {
        departmentMembers: {
          include: { department: true },
          where: { isPrimary: true },
          take: 1,
        },
      },
    });
    if (existingUser) {
      // placeholder.localのメールを本物のメールに更新
      if (existingUser.email.endsWith("@placeholder.local")) {
        return await prisma.user.update({
          where: { id: existingUser.id },
          data: { email, name: name || existingUser.name },
          include: {
            departmentMembers: {
              include: { department: true },
              where: { isPrimary: true },
              take: 1,
            },
          },
        });
      }
      // 既に別のメールが設定されている → そのまま返す（メールは変更しない）
      return existingUser;
    }
  }

  // 3. 新規ユーザー作成
  return await prisma.user.create({
    data: {
      email,
      loginId,
      name: name || email.split("@")[0],
    },
    include: {
      departmentMembers: {
        include: { department: true },
        where: { isPrimary: true },
        take: 1,
      },
    },
  });
}

// ユーザーが管理する部署IDを取得
async function getManagedDepartmentIds(userId: string): Promise<string[]> {
  const memberships = await prisma.departmentMember.findMany({
    where: { userId, role: "manager" },
    select: { departmentId: true },
  });
  return memberships.map((m) => m.departmentId);
}

const config: NextAuthConfig = {
  providers: [
    // 開発用: Credentials認証
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

        const user = await findOrCreateUser(email, loginId, null);
        const managedDeptIds = await getManagedDepartmentIds(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          managedDepartmentIds: managedDeptIds,
        };
      },
    }),

    // 本番用: Keycloak (OIDC/SAML)
    // KeycloakがSAML IdP（EntraID等）をブリッジしてOIDCで提供
    ...(process.env.KEYCLOAK_CLIENT_ID
      ? [
          Keycloak({
            clientId: process.env.KEYCLOAK_CLIENT_ID,
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
            issuer: process.env.KEYCLOAK_ISSUER, // https://keycloak.example.com/realms/your-realm
          }),
        ]
      : []),
  ],
  callbacks: {
    // OAuthプロバイダー（Keycloak等）からのサインイン時に呼ばれる
    async signIn({ user, account, profile }) {
      if (account?.provider === "keycloak" && profile) {
        const email = profile.email as string;
        const loginId =
          (profile.preferred_username as string) ||
          (profile.upn as string) ||
          null;
        const name = profile.name as string | null;

        if (!email) return false;

        const dbUser = await findOrCreateUser(email, loginId, name);
        const managedDeptIds = await getManagedDepartmentIds(dbUser.id);

        user.id = dbUser.id;
        (user as { role?: string }).role = dbUser.role;
        (user as { managedDepartmentIds?: string[] }).managedDepartmentIds =
          managedDeptIds;
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      // 初回サインイン時
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.managedDepartmentIds = (
          user as { managedDepartmentIds?: string[] }
        ).managedDepartmentIds;
      }

      // Keycloakからの追加情報
      if (account?.provider === "keycloak" && profile) {
        token.loginId =
          (profile.preferred_username as string) ||
          (profile.upn as string) ||
          null;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { managedDepartmentIds?: string[] }).managedDepartmentIds =
          token.managedDepartmentIds as string[];
        (session.user as { loginId?: string }).loginId =
          token.loginId as string;
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
