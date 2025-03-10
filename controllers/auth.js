const User = require("../models/User");
const Token = require("../models/Token");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");
const { sendResetPasswordEmail, sendVerificationEmail } = require("../helpers");
const { generateToken } = require("../services/token.service");
const bcrypt = require('bcrypt');

//Email
const verifyEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Email ve doğrulama kodu gereklidir."
      });
    }

    const user = await User.findOne({ email }).select('auth isVerified');

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Bu email adresi ile kayıtlı kullanıcı bulunamadı."
      });
    }

    if (user.isVerified) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Bu hesap zaten doğrulanmış."
      });
    }

    const numericVerificationCode = Number(verificationCode);

    if (user.auth.verificationCode !== numericVerificationCode) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Geçersiz doğrulama kodu. Lütfen tekrar kontrol ediniz."
      });
    }

    user.isVerified = true;
    user.auth.verificationCode = undefined;
    await user.save();

    return res.status(StatusCodes.OK).json({
      message: "Email adresiniz başarıyla doğrulandı."
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Email doğrulama işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyiniz."
    });
  }
};

//Again Email
const againEmail = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Kullanıcı bulunamadı.");
  }

  const verificationCode = Math.floor(1000 + Math.random() * 9000);

  user.auth.verificationCode = verificationCode;
  await user.save();

  await sendVerificationEmail({
    name: user.name,
    email: user.email,
    verificationCode: verificationCode,
  });
  res.json({ message: "Doğrulama kodu Gönderildi" });
};

//Register
const register = async (req, res, next) => {
  try {
    const { name, email, password, picture } = req.body;

    //check email
    const emailAlreadyExists = await User.findOne({ email });
    if (emailAlreadyExists) {
      throw new CustomError.BadRequestError("Bu e-posta adresi zaten kayıtlı.");
    }

    const user = new User({
      name,
      email,
      profile: { picture },
      auth: {
        password,
      }
    });

    await user.save();

    const accessToken = await generateToken(
      { userId: user._id },
      "1d",
      process.env.ACCESS_TOKEN_SECRET
    );
    const refreshToken = await generateToken(
      { userId: user._id },
      "30d",
      process.env.REFRESH_TOKEN_SECRET
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/v1/auth/refreshtoken",
      maxAge: 30 * 24 * 60 * 60 * 1000, //30 days
    });

    res.json({
      message:
        "Kullanıcı başarıyla oluşturuldu. Lütfen email adresini doğrula.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        picture: user.profile.picture,
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

//Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new CustomError.BadRequestError(
        "Lütfen e-posta adresinizi ve şifrenizi girin"
      );
    }
    const user = await User.findOne({ email }).select('auth profile isVerified name email role');

    if (!user) {
      throw new CustomError.UnauthenticatedError(
        "Ne yazık ki böyle bir kullanıcı yok"
      );
    }
    const isPasswordCorrect = await user.auth.comparePassword(password);

    if (!isPasswordCorrect) {
      throw new CustomError.UnauthenticatedError("Kayıtlı şifreniz yanlış!");
    }
    if (!user.isVerified) {
      throw new CustomError.UnauthenticatedError(
        "Lütfen e-postanızı doğrulayın !"
      );
    }

    const accessToken = await generateToken(
      { userId: user._id, role: user.role },
      "1d",
      process.env.ACCESS_TOKEN_SECRET
    );
    const refreshToken = await generateToken(
      { userId: user._id, role: user.role },
      "30d",
      process.env.REFRESH_TOKEN_SECRET
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/v1/auth/refreshtoken",
      maxAge: 30 * 24 * 60 * 60 * 1000, //30 days
    });

    const token = new Token({
      refreshToken,
      accessToken,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      user: user._id,
    });

    await token.save();

    res.json({
      message: "login success.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        picture: user.profile.picture,
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

//Get My Profile
const getMyProfile = async (req, res, next) => {
  const user = await User.findById(req.user.userId);

  res.status(200).json({
    success: true,
    user,
  });
};

//Logout
const logout = async (req, res, next) => {
  try {
    await Token.findOneAndDelete({ user: req.user.userId });

    res.clearCookie("refreshtoken", { path: "/v1/auth/refreshtoken" });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Logged out!",
    });
  } catch (error) {
    next(error);
  }
};

//Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new CustomError.BadRequestError("Please provide valid email");
  }

  const user = await User.findOne({ email });

  if (user) {
    const passwordToken = crypto.randomBytes(70).toString("hex");
    // send email
    await sendResetPasswordEmail({
      name: user.name,
      email: user.email,
      token: passwordToken,
    });

    const tenMinutes = 1000 * 60 * 10;
    const passwordTokenExpirationDate = new Date(Date.now() + tenMinutes);

    user.auth.passwordToken = passwordToken;
    user.auth.passwordTokenExpirationDate = passwordTokenExpirationDate;
    await user.save();
  }

  res
    .status(StatusCodes.OK)
    .json({ msg: "Please check your email for reset password link" });
};

//Reset Password
const resetPassword = async (req, res) => {
  const { token, email, password } = req.body;
  if (!token || !email || !password) {
    throw new CustomError.BadRequestError("Please provide all values");
  }
  const user = await User.findOne({ email }).select('auth');

  if (user) {
    const currentDate = new Date();

    if (
      user.auth.passwordToken === token &&
      user.auth.passwordTokenExpirationDate > currentDate
    ) {
      user.auth.password = password;
      user.auth.passwordToken = null;
      user.auth.passwordTokenExpirationDate = null;
      await user.save();
    }
  }

  res.send("reset password");
};

//Edit Profile
const editProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new CustomError.NotFoundError("User not found");
    }

    const { name, email, password } = req.body;

    if (name) user.name = name;
    if (password) user.auth.password = password; 

    // Handle email change
    if (email && email !== user.email) {
      // Check if new email already exists
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        throw new CustomError.BadRequestError("Bu e-posta adresi zaten kayıtlı.");
      }

      // Generate verification code
      const verificationCode = Math.floor(1000 + Math.random() * 9000);
      
      // Update email and set verification status
      user.email = email;
      user.isVerified = false;
      user.auth.verificationCode = verificationCode;

      // Send verification email
      await sendVerificationEmail({
        name: user.name,
        email: email,
        verificationCode: verificationCode,
      });
    }

    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: email && email !== user.email 
        ? "Profil güncellendi. Lütfen yeni email adresinizi doğrulayın."
        : "Profil başarıyla güncellendi",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        address: user.address,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    if (error instanceof CustomError.BadRequestError) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Bir hata oluştu.", error: error.message });
    }
  }
};

// Get All Users
const getAllUsers = async (req, res) => {
  const users = await User.find({}).select('name email role isVerified status createdAt');
  res.status(StatusCodes.OK).json({ users });
};

// Edit User (Admin Only)
const editUsers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, status } = req.body;

    const admin = await User.findById(req.user.userId);

    // Check if the requesting user is admin
    if (admin.role !== 'admin') {
      return res.status(StatusCodes.FORBIDDEN).json({ 
        message: "Bu işlemi sadece admin yapabilir" 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ 
        message: "Kullanıcı bulunamadı" 
      });
    }

    // Update user fields if provided
    if (role) user.role = role;
    if (status !== undefined) user.status = status;

    await user.save();

    res.status(StatusCodes.OK).json({ 
      message: "Kullanıcı bilgileri güncellendi",
      user 
    });
  } catch (error) {
    console.error("Error in editUsers:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Kullanıcı güncellenirken bir hata oluştu",
      error: error.message
    });
  }
};

// Delete User (Admin Only)
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const admin = await User.findById(req.user.userId);
  
    // Check if the requesting user is admin
    if (admin.role !== 'admin') {
      return res.status(StatusCodes.FORBIDDEN).json({ 
        message: "Bu işlemi sadece admin yapabilir" 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ 
        message: "Kullanıcı bulunamadı" 
      });
    }

    await User.findByIdAndDelete(userId);

    res.status(StatusCodes.OK).json({ 
      message: "Kullanıcı başarıyla silindi" 
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Kullanıcı silinirken bir hata oluştu",
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  verifyEmail,
  againEmail,
  forgotPassword,
  resetPassword,
  getMyProfile,
  editProfile,
  getAllUsers,
  editUsers,
  deleteUser,
};
