import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { z } from "zod"
import { loginSchema } from "@/lib/validations"
import { supabase } from "@/lib/supabaseClient"

export const authOptions: any = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { type: "password" }
      },
      async authorize(credentials) {
        // const validatedFields = LoginSchema.safeParse(credentials);

        // if (validatedFields.success) {
          const email = credentials?.email;
          const password = credentials?.password;

          const { data: user, error } = await supabase
            .from("users")
            .select('*')
            .eq('email', email)
            .single()

          if (error) {
            console.error('Error fetching user:', error)
            return null
          }

          if (!user) {
            console.error('No user found with that email');
            return null;
          }

          // Block login unless user.is_deleted is strictly false
          // Treat true/1/'true'/null/undefined as blocked
          const isDeletedNormalized = (
            user.is_deleted === true ||
            user.is_deleted === 1 ||
            user.is_deleted === 'true' ||
            user.is_deleted === 't' ||
            user.is_deleted === '1' ||
            user.is_deleted === null ||
            typeof user.is_deleted === 'undefined'
          );
          if (isDeletedNormalized) {
            console.error('Login blocked: user is marked as deleted or not explicitly active');
            return null;
          }

          // Check if user is approved
          if (user.status !== 'approved') {
            console.error('User account is not approved');
            return null;
          }

          // In production, you would hash the password and compare it with the stored hash
          // For example, using bcrypt: https://www.npmjs.com/package/bcrypt
          if (user.password !== password) {
            console.error('Incorrect password');
            return null;
          }

          return user
        // }

        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token?.role) {
        session.user.role = token.role;
      }
      return session;
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }