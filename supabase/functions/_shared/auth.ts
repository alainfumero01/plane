import { createUserClient } from "./client.ts";

export type AuthUser = {
  id: string;
  email: string | null;
};

export const requireUser = async (authorization: string | null): Promise<AuthUser> => {
  if (!authorization) {
    throw new Error("Missing Authorization header.");
  }

  const client = createUserClient(authorization);
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error("Invalid access token.");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
};
