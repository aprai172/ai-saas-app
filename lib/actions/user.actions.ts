// lib/actions/user.actions.ts
import User, { IUser } from "@/lib/database/models/user.model";
import { connectToDatabase } from "@/lib/database/mongoose"; // your db helper

export const createUser = async (userData: Partial<IUser>) => {
  await connectToDatabase();

  // Idempotent: if user exists, return it; else create
  const user = await User.findOneAndUpdate(
    { clerkId: userData.clerkId },
    { $setOnInsert: userData },
    { new: true, upsert: true }
  );

  return user;
};

export const updateUser = async (
  clerkId: string,
  data: Partial<IUser>
) => {
  await connectToDatabase();

  const user = await User.findOneAndUpdate({ clerkId }, data, {
    new: true,
  });

  return user;
};

export const deleteUser = async (clerkId: string) => {
  await connectToDatabase();

  const user = await User.findOneAndDelete({ clerkId });

  return user;
};
