const mongoose = require('mongoose');

const footerSchema = new mongoose.Schema({
  login: {
    content: { type: String, required: true }
  },
  info: {
    title: { type: String, required: true },
    content: { type: String, required: true }
  },
  kvk: {
    title: { type: String, required: true },
    content: { type: String, required: true }
  },
  socialMenu: [{
    title: { type: String, required: true },
    url: { type: String, required: true }
  }],
}, { timestamps: true });

const Footer = mongoose.model('Footer', footerSchema);

module.exports = Footer;