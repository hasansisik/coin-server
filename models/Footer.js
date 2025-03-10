const mongoose = require('mongoose');

const footerSchema = new mongoose.Schema({
  aboutUs: { type: String,  },
  copyright: { type: String, },
  cookiePolicy: {
    title: { type: String, required: true },
    content: { type: String, required: true }
  },
  kvk: {
    title: { type: String, required: true },
    content: { type: String, required: true }
  },
  forms: [{
    email: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  socialMenu: [{
    title: { type: String, required: true },
    url: { type: String, required: true }
  }],
}, { timestamps: true });

const Footer = mongoose.model('Footer', footerSchema);

module.exports = Footer;