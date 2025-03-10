const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const AddressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, trim: true, default: "Turkey" },
});

const AuthSchema = new mongoose.Schema({
  password: { type: String, required: true, select: false },
  verificationCode: { type: Number},
  passwordToken: { type: String, select: false },
  passwordTokenExpirationDate: { type: Date, select: false },
});

const ProfileSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    validate: {
      validator: function (v) {
        return /^(\+90|0)?5\d{9}$/.test(v);
      },
      message: (props) => `${props.value} is not a valid phone number!`,
    },
  },
  picture: {
    type: String,
    default: "https://cdn-icons-png.freepik.com/512/8188/8188362.png",
  },
});

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: [true, "Please provide your email address"],
      unique: true,
      lowercase: true,
    },
    role: { type: String, enum: ["admin", "user","editör"], default: "user" },
    isVerified: { type: Boolean, default: true },
    address: AddressSchema,
    auth: AuthSchema, 
    profile: ProfileSchema, 
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: '{VALUE} geçerli bir durum değil'
      },
      default: 'active'
    }
  },
  { timestamps: true }
);

// Şifreyi hashleme işlemi
AuthSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Şifre karşılaştırma metodu
AuthSchema.methods.comparePassword = async function (candidatePassword) {
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  return isMatch;
};

const User = mongoose.model("User", UserSchema);
module.exports = User;
