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
    include: { department: true },
  });

  if (user) {
    // loginIdが未設定なら紐づけ
    if (loginId && !user.loginId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { loginId },
        include: { department: true },
      });
    }
    return user;
  }

  // 2. loginIdで既存ユーザーを検索（エージェントが先にデータを送った場合）
  if (loginId) {
    const existingUser = await prisma.user.findUnique({
      where: { loginId },
      include: { department: true },
    });
    if (existingUser) {
      // placeholder.localのメールを本物のメールに更新
      if (existingUser.email.endsWith("@placeholder.local")) {
        return await prisma.user.update({
          where: { id: existingUser.id },
          data: { email, name: name || existingUser.name },
          include: { department: true },
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
    include: { department: true },
  });
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          departmentId: user.departmentId,
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
        // Keycloakから送られる属性
        // - email: メールアドレス
        // - preferred_username: UPN（WindowsログインID）
        // - name: 表示名
        const email = profile.email as string;
        const loginId =
          (profile.preferred_username as string) ||
          (profile.upn as string) ||
          null;
        const name = profile.name as string | null;

        if (!email) return false;

        // DBにユーザーを作成/更新
        const dbUser = await findOrCreateUser(email, loginId, name);

        // NextAuthのuserオブジェクトを更新
        user.id = dbUser.id;
        (user as { role?: string }).role = dbUser.role;
        (user as { departmentId?: string }).departmentId =
          dbUser.departmentId ?? undefined;
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      // 初回サインイン時
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.departmentId = (user as { departmentId?: string }).departmentId;
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
        (session.user as { departmentId?: string }).departmentId =
          token.departmentId as string;
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
