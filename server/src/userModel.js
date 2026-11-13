import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true }, // never the password itself
  },
  { timestamps: true },
);
const User = mongoose.model("User", schema);

const plain = (d) => (d ? { id: String(d._id), name: d.name, email: d.email, passwordHash: d.passwordHash } : null);

export const mongoUsers = {
  findByEmail: async (email) => plain(await User.findOne({ email })),
  findById: async (id) => (mongoose.isValidObjectId(id) ? plain(await User.findById(id)) : null),
  create: async (data) => {
    try {
      return plain(await User.create(data));
    } catch (e) {
      if (e.code === 11000) return null; // duplicate email (race between two sign-ups)
      throw e;
    }
  },
};
