import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Utilizador", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const validUser = process.env.AUTH_USERNAME ?? "admin";
        const validPass = process.env.AUTH_PASSWORD;

        if (!validPass) {
          console.error("[auth] AUTH_PASSWORD não definida em .env.local");
          return null;
        }

        if (credentials.username === validUser && credentials.password === validPass) {
          return { id: "1", name: validUser };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
